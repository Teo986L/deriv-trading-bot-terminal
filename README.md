# 🤖 Trading Bot Inteligente - Terminal Edition

Bot de trading automatizado com análise multi-timeframe, detecção de padrões Elliott Wave e Quasimodo, e interface estilo terminal para computador e celular.

![Trading Bot Terminal](https://via.placeholder.com/800x400/000000/00ff00?text=Trading+Bot+Terminal)

## 📊 Funcionalidades

- **Análise Multi-Timeframe**: M5, M15, M30, H1, H4, H24
- **Elliott Wave Master**: Detecção automática de ondas de impulso e correção
- **Quasimodo Pattern**: Identificação de níveis de suporte e resistência
- **MACD Estrutural**: Separação entre estrutura e momentum
- **Sistema de Pesos Dinâmicos**: Adaptação automática às condições do mercado
- **Controle de Horário**: Expiração de sinais e próximos candles
- **Interface Terminal**: Estilo clássico com linhas para PC e celular
- **Sincronização em Tempo Real**: Servidor Node.js distribui sinais para múltiplos dispositivos

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express
- **Análise Técnica**: JavaScript puro
- **Interface**: HTML, CSS (estilo terminal)
- **Comunicação**: REST API

## 📦 Estrutura do Projeto

```
projeto/
├── server/
│   └── bot.js                 # Servidor com toda lógica de análise
├── public/
│   ├── index.html             # Página principal
│   ├── script_computador.js   # Cliente para PC
│   └── script_celular.js      # Cliente para celular
├── package.json                # Dependências
└── README.md                   # Este arquivo
```

## 🚀 Como Instalar e Executar

### Pré-requisitos
- Node.js instalado
- NPM ou Yarn

### Passo a Passo

```bash
# 1. Clone o repositório
git clone https://github.com/Teo986L/deriv-trading-bot-terminal.git
cd trading-bot-inteligente-terminal

# 2. Instale as dependências
npm install express cors

# 3. Inicie o servidor
node server/bot.js
```

### Configurar o Cliente

**No computador**: 
Abra `public/index.html` no navegador

**No celular**:
1. Descubra o IP do seu computador (`ipconfig` no Windows ou `ifconfig` no Mac/Linux)
2. Edite `public/script_celular.js` e altere:
```javascript
const SERVER_URL = 'http://SEU-IP:3000';
```
3. Abra `public/index.html` no navegador do celular

## 📱 Interface Terminal

```
╔═══════════════════════════════════════════════════════════════════╗
║                    TRADING BOT INTELLIGENT                        ║
║              Multi-Timeframe | Análise Avançada                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  ⏰ CONTROLE DE HORÁRIO                                           ║
║  ──────────────────────────────────────────────────────────────  ║
║  🕐 HORA ATUAL: 15:30:45                    📅 DATA: 17/02/2026  ║
║  ⏱️  PRÓXIMO M5: 1 min                       ⏱️  PRÓXIMO H1: 29 min║
║  ⚡ MELHOR AGORA: M15 (Melhor horário)                           ║
║                                                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  🎯 SINAL PRINCIPAL: 🔴 VENDA (PUT) 88%                          ║
║  💡 AÇÃO: MANTER VENDA (stop móvel 68.300)                       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

## ⚙️ Configurações

### Timeframes Disponíveis
- `M5`: 5 minutos
- `M15`: 15 minutos
- `M30`: 30 minutos
- `H1`: 1 hora
- `H4`: 4 horas
- `H24`: 24 horas

### Indicadores Técnicos
- RSI (período 14)
- ADX (período 14)
- MACD (12, 26, 9)
- Elliott Wave (lookback 50)
- Quasimodo (lookback 30)

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir novas funcionalidades
- Melhorar a documentação
- Enviar pull requests

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Contato

- GitHub: [@teo986l](https://github.com/teo986l)
- Email: 

## 🙏 Agradecimentos

- Comunidade de trading algorítmico
- Desenvolvedores de bibliotecas de análise técnica
- Todos os usuários e contribuidores

---

**Desenvolvido com 💕 para traders que amam tecnologia**

---

## 🎯 Tags do Projeto

- `trading-bot`
- `crypto-trading`
- `technical-analysis`
- `elliott-wave`
- `quasimodo`
- `nodejs`
- `terminal-interface`
- `multi-timeframe`
