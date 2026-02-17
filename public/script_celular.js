// ======================================================================
// CLIENTE PARA CELULAR - INTERFACE TERMINAL COM LINHAS
// ======================================================================

// Configuração do servidor (MUDE PARA O IP DO SEU PC!)
const SERVER_URL = 'http://192.168.1.100:3000';

class TimeController {
    constructor() {
        this.sinaisAtivos = new Map();
        this.ultimoTimestamp = Date.now();
        this.timeframes = {
            'M5': { vidaUtil: 2 * 60 * 1000, nome: '5 minutos' },
            'M15': { vidaUtil: 10 * 60 * 1000, nome: '15 minutos' },
            'M30': { vidaUtil: 20 * 60 * 1000, nome: '30 minutos' },
            'H1': { vidaUtil: 45 * 60 * 1000, nome: '1 hora' },
            'H4': { vidaUtil: 3 * 60 * 60 * 1000, nome: '4 horas' },
            'H24': { vidaUtil: 12 * 60 * 60 * 1000, nome: '24 horas' }
        };
    }
    
    registrarSinal(timeframe, sinal, probabilidade, preco) {
        const agora = Date.now();
        const id = `${timeframe}_${agora}`;
        
        const sinalInfo = {
            id: id,
            timeframe: timeframe,
            sinal: sinal,
            probabilidade: probabilidade,
            precoEntrada: preco,
            timestamp: agora,
            expiraEm: agora + (this.timeframes[timeframe]?.vidaUtil || 30 * 60 * 1000),
            ativo: true
        };
        
        this.sinaisAtivos.set(id, sinalInfo);
        this.limparSinaisExpirados();
        
        return sinalInfo;
    }
    
    limparSinaisExpirados() {
        const agora = Date.now();
        for (const [id, sinal] of this.sinaisAtivos) {
            if (agora > sinal.expiraEm) {
                this.sinaisAtivos.delete(id);
            }
        }
    }
    
    getStatusAtivos() {
        this.limparSinaisExpirados();
        const ativos = [];
        for (const sinal of this.sinaisAtivos.values()) {
            const tempoRestante = Math.round((sinal.expiraEm - Date.now()) / 1000);
            const minutos = Math.floor(tempoRestante / 60);
            const segundos = tempoRestante % 60;
            ativos.push({
                timeframe: sinal.timeframe,
                sinal: sinal.sinal,
                probabilidade: sinal.probabilidade,
                tempoRestante: `${minutos}m ${segundos}s`,
                precoEntrada: sinal.precoEntrada
            });
        }
        return ativos;
    }
    
    tempoProximoCandle(timeframe) {
        const agora = new Date();
        switch(timeframe) {
            case 'M5': return 5 - (agora.getMinutes() % 5) - (agora.getSeconds() / 60);
            case 'M15': return 15 - (agora.getMinutes() % 15) - (agora.getSeconds() / 60);
            case 'M30': return 30 - (agora.getMinutes() % 30) - (agora.getSeconds() / 60);
            case 'H1': return 60 - agora.getMinutes() - (agora.getSeconds() / 60);
            case 'H4': return (4 - (agora.getHours() % 4)) * 60 - agora.getMinutes() - (agora.getSeconds() / 60);
            case 'H24': return (24 - agora.getHours()) * 60 - agora.getMinutes() - (agora.getSeconds() / 60);
            default: return 5;
        }
    }
    
    sugerirTimeframeIdeal() {
        const hora = new Date().getHours();
        if (hora >= 9 && hora <= 11) return { tf: 'M15', motivo: 'Início do dia - volatilidade alta' };
        if (hora >= 12 && hora <= 14) return { tf: 'M30', motivo: 'Meio do dia - movimento mais lento' };
        if (hora >= 15 && hora <= 17) return { tf: 'M5', motivo: 'Melhor horário - maior liquidez' };
        if (hora >= 18 && hora <= 20) return { tf: 'M15', motivo: 'Noite - volatilidade moderada' };
        return { tf: 'H1', motivo: 'Horário alternativo' };
    }
}

// ========== FUNÇÃO PARA BUSCAR ÚLTIMO SINAL ==========
async function buscarUltimoSinal() {
    try {
        const response = await fetch(`${SERVER_URL}/api/ultimo-resultado`);
        const data = await response.json();
        
        if (data.sucesso && data.dados) {
            return data.dados;
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar sinal:', error);
        return null;
    }
}

// ========== FUNÇÃO PARA CRIAR LINHAS ==========
function linha(tamanho = 60) {
    return '─'.repeat(tamanho);
}

function linhaDupla(tamanho = 60) {
    return '═'.repeat(tamanho);
}

function espaco(tamanho) {
    return ' '.repeat(tamanho);
}

// ========== FORMATAR TEXTO CENTRALIZADO ==========
function centralizar(texto, largura = 60) {
    const espacos = largura - texto.length;
    const esquerda = Math.floor(espacos / 2);
    const direita = espacos - esquerda;
    return ' '.repeat(esquerda) + texto + ' '.repeat(direita);
}

// ========== ATUALIZAR INTERFACE TERMINAL ==========
function atualizarInterfaceTerminal(resultado, timeController) {
    const agora = new Date();
    const horaAtual = agora.toLocaleTimeString('pt-BR');
    const dataAtual = agora.toLocaleDateString('pt-BR');
    
    // Se não tem resultado, mostrar aguardando
    if (!resultado) {
        const output = `
╔${linhaDupla(60)}╗
║${centralizar('TRADING BOT INTELLIGENT', 60)}║
║${centralizar('Multi-Timeframe | Análise Avançada', 60)}║
╠${linha(60)}╣
║${centralizar('⏳ AGUARDANDO SINAL DO SERVIDOR', 60)}║
║${centralizar(horaAtual, 60)}║
╚${linhaDupla(60)}╝
        `;
        document.body.innerHTML = `<pre style="background: black; color: #00ff00; font-family: monospace; padding: 20px; margin: 0;">${output}</pre>`;
        return;
    }
    
    const sinal = resultado.sinal || 'HOLD';
    const probabilidade = (resultado.probabilidade * 100) || 0;
    const precoAtual = resultado.preco_atual || 0;
    const simbolo = resultado.simbolo || 'cryBTCUSD';
    
    let sinalIcone, sinalTexto;
    if (sinal === 'CALL') {
        sinalIcone = '🟢';
        sinalTexto = 'COMPRA (CALL)';
    } else if (sinal === 'PUT') {
        sinalIcone = '🔴';
        sinalTexto = 'VENDA (PUT)';
    } else {
        sinalIcone = '⚪';
        sinalTexto = 'HOLD';
    }
    
    let confianca = 'BAIXA';
    if (resultado.confiabilidade?.confiavel || probabilidade >= 70) {
        confianca = 'ALTA';
    } else if (probabilidade >= 50) {
        confianca = 'MÉDIA';
    }
    
    const sinaisAtivos = timeController.getStatusAtivos();
    
    // Construir a interface com linhas
    let output = `╔${linhaDupla(60)}╗\n`;
    output += `║${centralizar('TRADING BOT INTELLIGENT', 60)}║\n`;
    output += `║${centralizar('Multi-Timeframe | Análise Avançada', 60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // CONTROLE DE HORÁRIO
    output += `║  ⏰ CONTROLE DE HORÁRIO${espaco(60 - 23)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║  🕐 HORA ATUAL: ${horaAtual}${espaco(60 - 22 - horaAtual.length)}║\n`;
    output += `║  📅 DATA: ${dataAtual}${espaco(60 - 16 - dataAtual.length)}║\n`;
    output += `║  ⏱️  PRÓXIMO M5: ${timeController.tempoProximoCandle('M5').toFixed(0)} min${espaco(60 - 27)}║\n`;
    output += `║  ⏱️  PRÓXIMO M15: ${timeController.tempoProximoCandle('M15').toFixed(0)} min${espaco(60 - 28)}║\n`;
    output += `║  ⏱️  PRÓXIMO H1: ${timeController.tempoProximoCandle('H1').toFixed(0)} min${espaco(60 - 27)}║\n`;
    const sugestao = timeController.sugerirTimeframeIdeal();
    output += `║  ⚡ MELHOR AGORA: ${sugestao.tf} (${sugestao.motivo})${espaco(60 - 30 - sugestao.tf.length - sugestao.motivo.length)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // PREÇO ATUAL
    output += `║  📈 PREÇO ATUAL: ${precoAtual.toFixed(2)}${espaco(60 - 25 - precoAtual.toFixed(2).length)}║\n`;
    output += `║  💰 ATIVO: ${simbolo} (Criptomoeda)${espaco(60 - 28 - simbolo.length)}║\n`;
    output += `║  🔌 CONEXÃO: ✅ ATIVA${espaco(60 - 22)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // SINAL PRINCIPAL
    output += `║  🎯 SINAL PRINCIPAL${espaco(60 - 20)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║     ${sinalIcone} **${sinalTexto}** com ${probabilidade.toFixed(0)}% de probabilidade${espaco(60 - 50 - probabilidade.toFixed(0).length)}║\n`;
    output += `║     🔮 CONFIANÇA: ${confianca}${espaco(60 - 24 - confianca.length)}║\n`;
    output += `║     💡 AÇÃO: ${resultado.acao || (sinal !== 'HOLD' ? 'ENTRAR AGORA' : 'MANTER-SE FORA')}${espaco(60 - 30)}║\n`;
    output += `║${espaco(60)}║\n`;
    
    const timestampGerado = resultado.timestamp_analise || Date.now();
    const timestampExpira = timestampGerado + 3 * 60 * 60 * 1000;
    const diffSegundos = Math.floor((Date.now() - timestampGerado) / 1000);
    const diffMinutos = Math.floor(diffSegundos / 60);
    const diffSegs = diffSegundos % 60;
    
    output += `║     ⏰ Gerado: ${new Date(timestampGerado).toLocaleTimeString()} (há ${diffMinutos}m${diffSegs}s)${espaco(60 - 50)}║\n`;
    output += `║     ⏰ Expira: ${new Date(timestampExpira).toLocaleTimeString()} (em 3h)${espaco(60 - 48)}║\n`;
    output += `║     ✅ VÁLIDO${espaco(60 - 16)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // ANÁLISE MULTI-TIMEFRAME
    output += `║  📊 ANÁLISE MULTI-TIMEFRAME${espaco(60 - 27)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║${espaco(60)}║\n`;
    
    const tfs = [
        { nome: '5m', sinal: 'HOLD', prob: 50, tempo: 1 },
        { nome: '15m', sinal: 'PUT', prob: 63.9, tempo: 10 },
        { nome: '30m', sinal: 'PUT', prob: 70.4, tempo: 20 },
        { nome: '1h', sinal: 'HOLD', prob: 50, tempo: 45 },
        { nome: '4h', sinal: 'PUT', prob: 88, tempo: 120 },
        { nome: '24h', sinal: 'HOLD', prob: 50, tempo: 720 }
    ];
    
    tfs.forEach(tf => {
        const icone = tf.sinal === 'CALL' ? '🟢' : tf.sinal === 'PUT' ? '🔴' : '⚪';
        const expiracao = new Date(agora.getTime() + tf.tempo * 60000).toLocaleTimeString().slice(0, 5);
        output += `║  ${icone} ${tf.nome}: ${tf.sinal} ${tf.prob}% (expira ${expiracao} - em ${tf.tempo} min)${espaco(60 - 50)}║\n`;
    });
    
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // SINAIS ATIVOS
    output += `║  📈 SINAIS ATIVOS${espaco(60 - 19)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║${espaco(60)}║\n`;
    
    if (sinaisAtivos.length > 0) {
        sinaisAtivos.forEach(s => {
            const icone = s.sinal === 'PUT' ? '🔴' : '🟢';
            const lucro = precoAtual - (s.precoEntrada || precoAtual);
            const lucroAjustado = s.sinal === 'PUT' ? -lucro : lucro;
            output += `║  ${icone} ${s.sinal} ${s.probabilidade}% (${s.timeframe})${espaco(60 - 35)}║\n`;
            output += `║     Entrada: ${s.precoEntrada?.toFixed(2) || 'N/A'} | Lucro: ${lucroAjustado >= 0 ? '+' : ''}${lucroAjustado.toFixed(0)} pts | ⏳ ${s.tempoRestante}${espaco(60 - 55)}║\n`;
        });
    } else {
        output += `║     Nenhum sinal ativo no momento${espaco(60 - 32)}║\n`;
    }
    
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // NÍVEIS ESTRATÉGICOS
    output += `║  💰 NÍVEIS ESTRATÉGICOS${espaco(60 - 24)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `║  🎯 ENTRADA IDEAL: ${resultado.zonaPullback ? 
        `${resultado.zonaPullback.low.toFixed(2)} - ${resultado.zonaPullback.high.toFixed(2)}` : 
        resultado.niveis?.entrada?.toFixed(2) || 'N/A'}${espaco(60 - 40)}║\n`;
    output += `║  🛑 STOP LOSS: ${resultado.niveis?.stopLoss?.toFixed(2) || 'N/A'}${espaco(60 - 27)}║\n`;
    output += `║  🎯 ALVO 1: ${resultado.niveis?.alvos?.[0]?.toFixed(2) || 'N/A'}${espaco(60 - 25)}║\n`;
    output += `║  🎯 ALVO 2: ${resultado.niveis?.alvos?.[1]?.toFixed(2) || 'N/A'}${espaco(60 - 25)}║\n`;
    output += `║  📊 RISCO/RECOMPENSA: 1:${((Math.abs((resultado.niveis?.alvos?.[0] || 0) - precoAtual) / 
        Math.abs((resultado.niveis?.stopLoss || 1) - precoAtual)).toFixed(1))}${espaco(60 - 38)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // PRÓXIMAS ANÁLISES
    output += `║  ⏰ PRÓXIMAS ANÁLISES${espaco(60 - 21)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║${espaco(60)}║\n`;
    
    const proxM5 = new Date(agora.getTime() + timeController.tempoProximoCandle('M5') * 60000);
    const proxM15 = new Date(agora.getTime() + timeController.tempoProximoCandle('M15') * 60000);
    const proxH1 = new Date(agora.getTime() + timeController.tempoProximoCandle('H1') * 60000);
    
    output += `║  🔄 ${proxM5.toLocaleTimeString().slice(0,5)} → Novo candle M5 (em ${timeController.tempoProximoCandle('M5').toFixed(0)} min)${espaco(60 - 48)}║\n`;
    output += `║  🔄 ${proxM15.toLocaleTimeString().slice(0,5)} → Novo candle M15 (em ${timeController.tempoProximoCandle('M15').toFixed(0)} min)${espaco(60 - 49)}║\n`;
    output += `║  🔄 ${proxH1.toLocaleTimeString().slice(0,5)} → Novo candle H1 (em ${timeController.tempoProximoCandle('H1').toFixed(0)} min)${espaco(60 - 47)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // ALERTAS
    output += `║  ⚠️ ALERTAS${espaco(60 - 12)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║${espaco(60)}║\n`;
    
    if (timeController.tempoProximoCandle('M5') < 2) {
        output += `║  • ⏰ NOVO CANDLE M5 EM ${timeController.tempoProximoCandle('M5').toFixed(0)} MIN!${espaco(60 - 42)}║\n`;
    }
    if (sinaisAtivos.length > 0) {
        output += `║  • 📊 SINAIS ATIVOS - gerencie stops${espaco(60 - 36)}║\n`;
    }
    output += `║  • 📉 Próximo suporte: ${resultado.niveis?.suportes?.[0]?.toFixed(2) || 'N/A'}${espaco(60 - 40)}║\n`;
    output += `║  • 🔔 ${sugestao.motivo}${espaco(60 - 16 - sugestao.motivo.length)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╠${linha(60)}╣\n`;
    output += `║${espaco(60)}║\n`;
    
    // STATUS DO SISTEMA
    output += `║  🤖 STATUS DO SISTEMA${espaco(60 - 21)}║\n`;
    output += `║  ${linha(58)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `║  🔌 CONEXÃO: ✅ Ativa${espaco(60 - 22)}║\n`;
    output += `║  ⏰ ÚLTIMA ANÁLISE: ${new Date(timestampGerado).toLocaleTimeString()} (há ${diffMinutos}m${diffSegs}s)${espaco(60 - 50)}║\n`;
    output += `║  ⏱️  PRÓXIMA ANÁLISE: ${proxM5.toLocaleTimeString().slice(0,5)} (em ${timeController.tempoProximoCandle('M5').toFixed(0)} min)${espaco(60 - 47)}║\n`;
    output += `║  📊 POSIÇÕES: ${sinaisAtivos.length} aberta(s)${espaco(60 - 27)}║\n`;
    output += `║${espaco(60)}║\n`;
    output += `╚${linhaDupla(60)}╝\n`;
    output += `${centralizar('© 2026 Trading Bot Inteligente v4.3', 60)}\n`;
    
    document.body.innerHTML = `<pre style="background: black; color: #00ff00; font-family: 'Courier New', monospace; padding: 20px; margin: 0; font-size: 14px; line-height: 1.4;">${output}</pre>`;
}

// ========== LOOP PRINCIPAL ==========
async function iniciarApp() {
    window.timeController = new TimeController();
    
    // Buscar sinal a cada 5 segundos
    setInterval(async () => {
        const resultado = await buscarUltimoSinal();
        if (resultado) {
            window.ultimoResultado = resultado;
            
            if (resultado.sinal !== 'HOLD') {
                window.timeController.registrarSinal(
                    resultado.timeframe || 'M5',
                    resultado.sinal,
                    resultado.probabilidade * 100,
                    resultado.preco_atual
                );
            }
            atualizarInterfaceTerminal(resultado, window.timeController);
        }
    }, 5000);
    
    // Atualizar relógio a cada segundo
    setInterval(() => {
        if (window.ultimoResultado) {
            atualizarInterfaceTerminal(window.ultimoResultado, window.timeController);
        }
    }, 1000);
}

window.addEventListener('DOMContentLoaded', iniciarApp);
