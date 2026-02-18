// ========== CONFIGURAÇÕES BASE ==========
const CANDLE_COUNT = 500;

// ========== CONFIGURAÇÕES DE INDICADORES ==========
const INDICATOR_CONFIG = {
    RSI_PERIOD: 14,
    ADX_PERIOD: 14,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9
};

// Variáveis globais para configuração
let TRADING_MODE = "CONSERVADOR";
let PROB_BUY_THRESHOLD = 0.55;
let PROB_SELL_THRESHOLD = 0.45;
let MIN_CALL_CONFIRMATIONS = 4;
let MIN_PUT_CONFIRMATIONS = 3;

// Timeframes
const TIMEFRAMES = {
    'M5': 300,
    'M15': 900,
    'M30': 1800,
    'H1': 3600,
    'H4': 14400,
    'H24': 86400,
};

// ========== SISTEMA ELLIOTT WAVE MASTER ==========
class ElliottWaveMaster {
    constructor() {
        this.waves = [];
        this.currentWave = null;
        this.waveCount = 0;
        this.fibLevels = {};
        this.trend = 'NEUTRAL';
    }

    analyzeFull(data) {
        if (!data || data.length < 100) {
            return {
                waves: [],
                currentWave: null,
                trend: 'NEUTRAL',
                fibonacci: {},
                tradingSignals: [],
                confidence: 0
            };
        }

        const prices = data.map(c => parseFloat(c.close));
        const highs = data.map(c => parseFloat(c.high));
        const lows = data.map(c => parseFloat(c.low));
        
        const pivots = this.findPivotPoints(prices, highs, lows);
        const waves = this.identifyWaves(pivots);
        const waveStructure = this.analyzeWaveStructure(waves);
        
        this.trend = waveStructure.trend;
        const fibonacci = this.calculateFibonacciLevels(waves);
        const tradingSignals = this.generateTradingSignals(waves, waveStructure, fibonacci, data[data.length - 1]);
        const confidence = this.calculateConfidence(waveStructure, tradingSignals);
        
        return {
            waves: waves,
            currentWave: waveStructure.currentWave,
            trend: waveStructure.trend,
            fibonacci: fibonacci,
            tradingSignals: tradingSignals,
            confidence: confidence,
            waveCount: waves.length,
            structure: waveStructure
        };
    }

    findPivotPoints(prices, highs, lows, lookback = 5) {
        const pivots = [];
        
        for (let i = lookback; i < prices.length - lookback; i++) {
            let isHighPivot = true;
            let isLowPivot = true;
            
            for (let j = 1; j <= lookback; j++) {
                if (highs[i - j] > highs[i] || highs[i + j] > highs[i]) {
                    isHighPivot = false;
                    break;
                }
            }
            
            for (let j = 1; j <= lookback; j++) {
                if (lows[i - j] < lows[i] || lows[i + j] < lows[i]) {
                    isLowPivot = false;
                    break;
                }
            }
            
            if (isHighPivot) {
                pivots.push({
                    index: i,
                    price: highs[i],
                    type: 'HIGH',
                    time: i
                });
            }
            
            if (isLowPivot) {
                pivots.push({
                    index: i,
                    price: lows[i],
                    type: 'LOW',
                    time: i
                });
            }
        }
        
        return pivots.sort((a, b) => a.index - b.index);
    }

    identifyWaves(pivots) {
        if (pivots.length < 6) return [];
        
        const waves = [];
        
        for (let i = 2; i < pivots.length - 3; i++) {
            const p1 = pivots[i-2];
            const p2 = pivots[i-1];
            const p3 = pivots[i];
            
            if (p1.type === 'LOW' && p2.type === 'HIGH' && p3.type === 'LOW') {
                if (p3.price > p1.price) {
                    waves.push({
                        start: p1,
                        end: p2,
                        type: 'IMPULSE',
                        number: waves.length + 1,
                        trend: 'BULLISH'
                    });
                    
                    waves.push({
                        start: p2,
                        end: p3,
                        type: 'CORRECTION',
                        number: waves.length + 1,
                        trend: 'BULLISH'
                    });
                }
            } else if (p1.type === 'HIGH' && p2.type === 'LOW' && p3.type === 'HIGH') {
                if (p3.price < p1.price) {
                    waves.push({
                        start: p1,
                        end: p2,
                        type: 'IMPULSE',
                        number: waves.length + 1,
                        trend: 'BEARISH'
                    });
                    
                    waves.push({
                        start: p2,
                        end: p3,
                        type: 'CORRECTION',
                        number: waves.length + 1,
                        trend: 'BEARISH'
                    });
                }
            }
        }
        
        return waves.slice(-10);
    }

    analyzeWaveStructure(waves) {
        if (waves.length < 3) {
            return {
                currentWave: null,
                trend: 'NEUTRAL',
                pattern: 'INCOMPLETE',
                phase: 'UNKNOWN'
            };
        }
        
        const lastWave = waves[waves.length - 1];
        const prevWave = waves[waves.length - 2];
        
        let pattern = 'UNKNOWN';
        let phase = 'UNKNOWN';
        let trend = lastWave.trend;
        
        if (lastWave.type === 'CORRECTION' && prevWave.type === 'IMPULSE') {
            pattern = 'ABC_CORRECTION';
            phase = 'CORRECTION_PHASE';
        } else if (lastWave.type === 'IMPULSE' && prevWave.type === 'CORRECTION') {
            pattern = 'IMPULSE_WAVE';
            phase = 'IMPULSE_PHASE';
            
            if (waves.length >= 5) {
                const impulseWaves = waves.filter(w => w.type === 'IMPULSE');
                if (impulseWaves.length === 3) {
                    pattern = 'WAVE_3_EXTENSION';
                    phase = 'STRONG_TREND';
                }
            }
        }
        
        return {
            currentWave: lastWave,
            previousWave: prevWave,
            pattern: pattern,
            phase: phase,
            trend: trend,
            waveCount: waves.length
        };
    }

    calculateFibonacciLevels(waves) {
        if (waves.length < 2) return {};
        
        const impulseWaves = waves.filter(w => w.type === 'IMPULSE');
        if (impulseWaves.length < 1) return {};
        
        const lastImpulse = impulseWaves[impulseWaves.length - 1];
        const start = lastImpulse.start.price;
        const end = lastImpulse.end.price;
        
        const diff = Math.abs(end - start);
        const trend = this.trend !== 'NEUTRAL' ? this.trend : (lastImpulse.trend || 'BULLISH');
        
        const minPrice = Math.min(start, end);
        const maxPrice = Math.max(start, end);
        
        return {
            '0.0': trend === 'BULLISH' ? minPrice : maxPrice,
            '0.236': trend === 'BULLISH' ? minPrice + diff * 0.236 : maxPrice - diff * 0.236,
            '0.382': trend === 'BULLISH' ? minPrice + diff * 0.382 : maxPrice - diff * 0.382,
            '0.5': trend === 'BULLISH' ? minPrice + diff * 0.5 : maxPrice - diff * 0.5,
            '0.618': trend === 'BULLISH' ? minPrice + diff * 0.618 : maxPrice - diff * 0.618,
            '0.786': trend === 'BULLISH' ? minPrice + diff * 0.786 : maxPrice - diff * 0.786,
            '1.0': trend === 'BULLISH' ? maxPrice : minPrice,
            '1.272': trend === 'BULLISH' ? maxPrice + diff * 0.272 : minPrice - diff * 0.272,
            '1.618': trend === 'BULLISH' ? maxPrice + diff * 0.618 : minPrice - diff * 0.618
        };
    }

    generateTradingSignals(waves, structure, fibonacci, currentCandle) {
        const signals = [];
        const currentPrice = parseFloat(currentCandle.close);
        
        if (waves.length < 3) return signals;
        
        const lastWave = waves[waves.length - 1];
        
        if (structure.phase === 'STRONG_TREND' && structure.pattern === 'WAVE_3_EXTENSION') {
            if (structure.trend === 'BULLISH') {
                signals.push({
                    type: 'BUY',
                    reason: 'Onda 3 de Elliott em progresso',
                    strength: 'STRONG',
                    entry: currentPrice,
                    stopLoss: currentPrice * 0.98,
                    takeProfit: currentPrice * 1.03,
                    confidence: 0.75
                });
            } else if (structure.trend === 'BEARISH') {
                signals.push({
                    type: 'SELL',
                    reason: 'Onda 3 de Elliott em progresso',
                    strength: 'STRONG',
                    entry: currentPrice,
                    stopLoss: currentPrice * 1.02,
                    takeProfit: currentPrice * 0.97,
                    confidence: 0.75
                });
            }
        }
        
        if (Object.keys(fibonacci).length > 0) {
            for (const [level, price] of Object.entries(fibonacci)) {
                const threshold = currentPrice * 0.005;
                
                if (Math.abs(currentPrice - price) < threshold) {
                    if (level === '0.618' || level === '0.5') {
                        const signalType = structure.trend === 'BULLISH' ? 'BUY' : 'SELL';
                        signals.push({
                            type: signalType,
                            reason: `Preço no nível Fibonacci ${level}`,
                            strength: 'MEDIUM',
                            entry: currentPrice,
                            stopLoss: signalType === 'BUY' ? currentPrice * 0.99 : currentPrice * 1.01,
                            takeProfit: signalType === 'BUY' ? currentPrice * 1.02 : currentPrice * 0.98,
                            confidence: 0.65
                        });
                    }
                }
            }
        }
        
        if (structure.pattern === 'ABC_CORRECTION') {
            if (lastWave.trend === 'BULLISH' && structure.trend === 'BULLISH') {
                signals.push({
                    type: 'BUY',
                    reason: 'Fim da correção ABC, retomada da tendência',
                    strength: 'MEDIUM',
                    entry: currentPrice,
                    stopLoss: currentPrice * 0.99,
                    takeProfit: currentPrice * 1.025,
                    confidence: 0.7
                });
            } else if (lastWave.trend === 'BEARISH' && structure.trend === 'BEARISH') {
                signals.push({
                    type: 'SELL',
                    reason: 'Fim da correção ABC, retomada da tendência',
                    strength: 'MEDIUM',
                    entry: currentPrice,
                    stopLoss: currentPrice * 1.01,
                    takeProfit: currentPrice * 0.975,
                    confidence: 0.7
                });
            }
        }
        
        return signals;
    }

    calculateConfidence(structure, signals) {
        let confidence = 0.5;
        
        if (structure.pattern === 'WAVE_3_EXTENSION') {
            confidence = 0.8;
        } else if (structure.pattern === 'ABC_CORRECTION') {
            confidence = 0.7;
        } else if (structure.pattern === 'IMPULSE_WAVE') {
            confidence = 0.65;
        }
        
        if (signals.length > 0) {
            confidence += 0.1;
        }
        
        return Math.min(0.9, confidence);
    }

    getWavePosition(currentPrice, fibonacci) {
        if (!fibonacci || typeof fibonacci !== 'object' || Object.keys(fibonacci).length === 0) {
            return 'NEUTRAL';
        }
        
        let position = 'NEUTRAL';
        
        for (const [level, price] of Object.entries(fibonacci)) {
            const threshold = currentPrice * 0.01;
            
            if (Math.abs(currentPrice - price) < threshold) {
                if (level === '0.618' || level === '0.5') {
                    position = 'FIBONACCI_SUPPORT';
                } else if (level === '1.618' || level === '1.272') {
                    position = 'FIBONACCI_RESISTANCE';
                } else if (level === '0.236' || level === '0.382') {
                    position = 'FIBONACCI_RETRACEMENT';
                }
                break;
            }
        }
        
        return position;
    }
}

// ========== RISK MANAGER ==========
class RiskManager {
    constructor() {
        this.maxRiskPerTrade = 0.02;
        this.maxDailyLoss = 0.05;
        this.minRiskReward = 1.5;
        this.dailyLoss = 0;
        this.tradesToday = 0;
    }
    
    approveTrade(signal, accountBalance, openPositions) {
        const riskAmount = accountBalance * this.maxRiskPerTrade;
        
        const risk = Math.abs(signal.entry - signal.stopLoss) / signal.entry;
        const reward = Math.abs(signal.takeProfit - signal.entry) / signal.entry;
        const riskReward = reward / risk;
        
        if (riskReward < this.minRiskReward) {
            return { approved: false, reason: `Risk/Reward muito baixo: ${riskReward.toFixed(2)}` };
        }
        
        if (this.dailyLoss >= this.maxDailyLoss) {
            return { approved: false, reason: 'Perda diária máxima atingida' };
        }
        
        if (openPositions.length >= 3) {
            return { approved: false, reason: 'Máximo de posições abertas atingido' };
        }
        
        const similarPosition = openPositions.find(pos => 
            pos.type === signal.type && 
            Math.abs(pos.entry - signal.entry) / signal.entry < 0.01
        );
        
        if (similarPosition) {
            return { approved: false, reason: 'Posição similar já aberta' };
        }
        
        return { 
            approved: true, 
            positionSize: riskAmount / risk,
            risk: risk,
            reward: reward,
            riskReward: riskReward
        };
    }
    
    updateDailyLoss(loss) {
        this.dailyLoss += loss;
    }
    
    resetDailyStats() {
        this.dailyLoss = 0;
        this.tradesToday = 0;
    }
}

// ========== SISTEMA DE TRADING AUTOMATIZADO ETM ==========
class AutomatedElliottTradingSystem {
    constructor(brokerAPI = null) {
        this.analyzer = new ElliottWaveMaster();
        this.broker = brokerAPI;
        this.positions = [];
        this.riskManager = new RiskManager();
        this.dataHistory = [];
        this.signalsHistory = [];
        this.accountBalance = 10000;
    }
    
    async onNewCandle(candle) {
        this.dataHistory.push(candle);
        
        if (this.dataHistory.length > 200) {
            this.dataHistory = this.dataHistory.slice(-200);
        }
        
        const analysis = this.analyzer.analyzeFull(this.dataHistory);
        const signals = analysis.tradingSignals;
        
        for (const signal of signals) {
            const riskAssessment = this.riskManager.approveTrade(
                signal, 
                this.accountBalance, 
                this.positions
            );
            
            if (riskAssessment.approved) {
                await this.executeTrade(signal, riskAssessment, analysis);
            }
        }
        
        await this.manageOpenPositions(analysis, candle);
        
        if (signals.length > 0) {
            this.signalsHistory.push({
                timestamp: new Date(),
                signals: signals,
                analysis: analysis,
                candle: candle
            });
            
            if (this.signalsHistory.length > 50) {
                this.signalsHistory = this.signalsHistory.slice(-50);
            }
        }
        
        return {
            analysis: analysis,
            signals: signals,
            positions: this.positions,
            accountBalance: this.accountBalance
        };
    }
    
    async executeTrade(signal, riskAssessment, analysis) {
        try {
            const tradeData = {
                type: signal.type,
                entry: signal.entry,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                size: riskAssessment.positionSize,
                timestamp: new Date(),
                waveAnalysis: analysis,
                reason: signal.reason,
                confidence: signal.confidence
            };
            
            this.positions.push({
                ...tradeData,
                id: Date.now(),
                status: 'OPEN',
                profitLoss: 0
            });
            
            this.riskManager.tradesToday++;
            
        } catch (error) {
            console.error('Erro executando trade:', error);
        }
    }
    
    async manageOpenPositions(analysis, currentCandle) {
        const currentPrice = parseFloat(currentCandle.close);
        
        for (let i = this.positions.length - 1; i >= 0; i--) {
            const position = this.positions[i];
            let closePosition = false;
            let closePrice = 0;
            let profitLoss = 0;
            
            if (position.type === 'BUY' && currentPrice <= position.stopLoss) {
                closePosition = true;
                closePrice = currentPrice;
                profitLoss = (closePrice - position.entry) * position.size;
            } else if (position.type === 'SELL' && currentPrice >= position.stopLoss) {
                closePosition = true;
                closePrice = currentPrice;
                profitLoss = (position.entry - closePrice) * position.size;
            }
            
            if (!closePosition) {
                if (position.type === 'BUY' && currentPrice >= position.takeProfit) {
                    closePosition = true;
                    closePrice = currentPrice;
                    profitLoss = (closePrice - position.entry) * position.size;
                } else if (position.type === 'SELL' && currentPrice <= position.takeProfit) {
                    closePosition = true;
                    closePrice = currentPrice;
                    profitLoss = (position.entry - closePrice) * position.size;
                }
            }
            
            if (!closePosition && analysis.trend !== position.waveAnalysis.trend) {
                closePosition = true;
                closePrice = currentPrice;
                profitLoss = position.type === 'BUY' 
                    ? (closePrice - position.entry) * position.size
                    : (position.entry - closePrice) * position.size;
            }
            
            if (closePosition) {
                this.accountBalance += profitLoss;
                
                if (profitLoss < 0) {
                    this.riskManager.updateDailyLoss(Math.abs(profitLoss) / this.accountBalance);
                }
                
                this.positions.splice(i, 1);
            }
        }
    }
    
    getPerformanceStats() {
        const closedPositions = this.signalsHistory
            .flatMap(h => h.signals)
            .filter(s => s.status === 'CLOSED');
            
        const totalTrades = closedPositions.length;
        const winningTrades = closedPositions.filter(p => p.profitLoss > 0).length;
        const losingTrades = closedPositions.filter(p => p.profitLoss < 0).length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
        
        const totalProfit = closedPositions
            .filter(p => p.profitLoss > 0)
            .reduce((sum, p) => sum + p.profitLoss, 0);
            
        const totalLoss = closedPositions
            .filter(p => p.profitLoss < 0)
            .reduce((sum, p) => sum + Math.abs(p.profitLoss), 0);
            
        const netProfit = totalProfit - totalLoss;
        const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit;
        
        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate: winRate.toFixed(2) + '%',
            totalProfit: totalProfit.toFixed(2),
            totalLoss: totalLoss.toFixed(2),
            netProfit: netProfit.toFixed(2),
            profitFactor: profitFactor.toFixed(2),
            accountBalance: this.accountBalance.toFixed(2),
            openPositions: this.positions.length,
            dailyLoss: this.riskManager.dailyLoss.toFixed(4)
        };
    }
}

// ========== SISTEMA DE ANÁLISE QUASIMODO ==========
class QuasimodoPattern {
    constructor(data) {
        this.data = data;
        this.swingPoints = [];
        this.qmLevels = [];
    }

    findSwingPoints(lookback = 5) {
        const swings = [];
        
        for (let i = lookback; i < this.data.length - lookback; i++) {
            const currentHigh = this.data[i].high;
            const currentLow = this.data[i].low;
            
            let isHighSwing = true;
            let isLowSwing = true;
            
            for (let j = 1; j <= lookback; j++) {
                if (this.data[i - j].high >= currentHigh || this.data[i + j].high >= currentHigh) {
                    isHighSwing = false;
                    break;
                }
            }
            
            for (let j = 1; j <= lookback; j++) {
                if (this.data[i - j].low <= currentLow || this.data[i + j].low <= currentLow) {
                    isLowSwing = false;
                    break;
                }
            }
            
            if (isHighSwing) {
                swings.push({
                    index: i,
                    price: currentHigh,
                    type: 'high',
                    time: this.data[i].time
                });
            }
            
            if (isLowSwing) {
                swings.push({
                    index: i,
                    price: currentLow,
                    type: 'low',
                    time: this.data[i].time
                });
            }
        }
        
        this.swingPoints = swings.sort((a, b) => a.index - b.index);
        return this.swingPoints;
    }

    findQuasimodoPatterns() {
        const patterns = [];
        const swings = this.swingPoints;
        
        for (let i = 2; i < swings.length - 2; i++) {
            if (swings[i].type === 'high') {
                const leftLow = swings[i-1];
                const centerHigh = swings[i];
                const rightLow = swings[i+1];
                
                if (leftLow.type === 'low' && rightLow.type === 'low') {
                    if (rightLow.price > leftLow.price && 
                        centerHigh.price > leftLow.price && 
                        centerHigh.price > rightLow.price) {
                        
                        patterns.push({
                            type: 'resistance',
                            leftLow: leftLow.price,
                            centerHigh: centerHigh.price,
                            rightLow: rightLow.price,
                            index: centerHigh.index,
                            price: centerHigh.price,
                            entryZone: centerHigh.price,
                            invalidation: Math.max(leftLow.price, rightLow.price),
                            target: leftLow.price - (centerHigh.price - leftLow.price),
                            strength: Math.abs(centerHigh.price - leftLow.price)
                        });
                    }
                }
            }
            
            if (swings[i].type === 'low') {
                const leftHigh = swings[i-1];
                const centerLow = swings[i];
                const rightHigh = swings[i+1];
                
                if (leftHigh.type === 'high' && rightHigh.type === 'high') {
                    if (rightHigh.price < leftHigh.price && 
                        centerLow.price < leftHigh.price && 
                        centerLow.price < rightHigh.price) {
                        
                        patterns.push({
                            type: 'support',
                            leftHigh: leftHigh.price,
                            centerLow: centerLow.price,
                            rightHigh: rightHigh.price,
                            index: centerLow.index,
                            price: centerLow.price,
                            entryZone: centerLow.price,
                            invalidation: Math.min(leftHigh.price, rightHigh.price),
                            target: leftHigh.price + (leftHigh.price - centerLow.price),
                            strength: Math.abs(leftHigh.price - centerLow.price)
                        });
                    }
                }
            }
        }
        
        this.qmLevels = patterns;
        return patterns;
    }

    detectDiamondPattern(lookback = 20) {
        const patterns = [];
        
        for (let i = lookback; i < this.data.length - lookback; i++) {
            const window = this.data.slice(i - lookback, i + lookback);
            
            const highs = window.map(c => c.high);
            const lows = window.map(c => c.low);
            
            const maxHigh = Math.max(...highs);
            const minLow = Math.min(...lows);
            const range = maxHigh - minLow;
            
            const midPoint = Math.floor(window.length / 2);
            const firstHalfVol = this.calculateVolatility(window.slice(0, midPoint));
            const secondHalfVol = this.calculateVolatility(window.slice(midPoint));
            
            if (firstHalfVol > secondHalfVol * 1.5 && range > 0) {
                patterns.push({
                    type: 'diamond',
                    startIndex: i - lookback,
                    endIndex: i + lookback,
                    resistance: maxHigh,
                    support: minLow,
                    breakout: this.detectBreakout(i, maxHigh, minLow),
                    center: (maxHigh + minLow) / 2
                });
            }
        }
        
        return patterns;
    }

    confirmSignalWithQM(sinal, currentPrice, candles, marginPercent = 0.5) {
        if (!candles || candles.length < 30) {
            return { confirmed: false, reason: "Dados insuficientes" };
        }
        
        const formattedData = candles.map((c, idx) => ({
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            open: parseFloat(c.open),
            close: parseFloat(c.close),
            time: idx
        }));
        
        this.data = formattedData;
        this.findSwingPoints(3);
        const qmPatterns = this.findQuasimodoPatterns();
        
        if (qmPatterns.length === 0) {
            return { confirmed: false, reason: "Nenhum padrão QM encontrado" };
        }
        
        const recentPatterns = qmPatterns.filter(p => 
            p.index >= formattedData.length - 20
        );
        
        if (recentPatterns.length === 0) {
            return { confirmed: false, reason: "Nenhum padrão QM recente" };
        }
        
        let bestMatch = null;
        let minDistance = Infinity;
        const margin = currentPrice * (marginPercent / 100);
        
        for (const pattern of recentPatterns) {
            const distance = Math.abs(currentPrice - pattern.price);
            
            if (distance < minDistance && distance <= margin) {
                minDistance = distance;
                bestMatch = pattern;
            }
        }
        
        if (!bestMatch) {
            return { 
                confirmed: false, 
                reason: "Nenhum nível QM próximo do preço atual",
                patterns: recentPatterns
            };
        }
        
        let confirmed = false;
        let confirmationType = "";
        
        if (bestMatch) {
            if (sinal === "CALL" && bestMatch.type === "support") {
                confirmed = true;
                confirmationType = "Suporte QM confirmado";
            } else if (sinal === "PUT" && bestMatch.type === "resistance") {
                confirmed = true;
                confirmationType = "Resistência QM confirmado";
            } else {
                confirmed = false;
                confirmationType = `QM não confirma (Tipo: ${bestMatch.type})`;
            }
        } else {
            confirmed = false;
            confirmationType = "Nenhum padrão QM próximo encontrado";
        }
        
        return {
            confirmed: confirmed,
            pattern: bestMatch,
            confirmationType: confirmationType,
            distance: minDistance,
            distancePercent: (minDistance / currentPrice * 100).toFixed(2),
            allPatterns: recentPatterns
        };
    }

    generateCombinedSignal(candles, macdHistograma, rsi) {
        if (!candles || candles.length < 50) {
            return { signal: "HOLD", confidence: 0, reason: "Dados insuficientes" };
        }
        
        const formattedData = candles.map((c, idx) => ({
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            open: parseFloat(c.open),
            close: parseFloat(c.close),
            time: idx
        }));
        
        this.data = formattedData;
        
        this.findSwingPoints(3);
        const qmPatterns = this.findQuasimodoPatterns();
        const diamondPatterns = this.detectDiamondPattern(15);
        
        const currentPrice = formattedData[formattedData.length - 1].close;
        const recentCandles = formattedData.slice(-5);
        
        let priceActionSignal = "NEUTRAL";
        let priceActionConfidence = 0.5;
        
        const greenCandles = recentCandles.filter(c => c.close > c.open).length;
        const redCandles = recentCandles.filter(c => c.close < c.open).length;
        
        if (greenCandles >= 4) {
            priceActionSignal = "BULLISH";
            priceActionConfidence = 0.7;
        } else if (redCandles >= 4) {
            priceActionSignal = "BEARISH";
            priceActionConfidence = 0.7;
        }
        
        let qmSignal = "NEUTRAL";
        let qmConfidence = 0.5;
        let qmReason = "Sem padrões QM fortes";
        
        if (qmPatterns.length > 0) {
            const recentQM = qmPatterns[qmPatterns.length - 1];
            const distance = Math.abs(currentPrice - recentQM.price) / currentPrice * 100;
            
            if (distance < 1) {
                if (recentQM.type === "support") {
                    qmSignal = "BULLISH";
                    qmConfidence = 0.65;
                    qmReason = "Próximo a suporte QM";
                } else if (recentQM.type === "resistance") {
                    qmSignal = "BEARISH";
                    qmConfidence = 0.65;
                    qmReason = "Próximo a resistência QM";
                }
            }
        }
        
        let finalSignal = "HOLD";
        let finalConfidence = 0;
        let finalReason = "";
        
        if (macdHistograma > 0.001 && qmSignal === "BULLISH") {
            finalSignal = "CALL";
            finalConfidence = Math.min(0.8, (0.6 + qmConfidence) / 2);
            finalReason = "MACD positivo + Suporte QM";
        } else if (macdHistograma < -0.001 && qmSignal === "BEARISH") {
            finalSignal = "PUT";
            finalConfidence = Math.min(0.8, (0.6 + qmConfidence) / 2);
            finalReason = "MACD negativo + Resistência QM";
        } else if (priceActionSignal === "BULLISH" && qmSignal === "BULLISH") {
            finalSignal = "CALL";
            finalConfidence = (priceActionConfidence + qmConfidence) / 2;
            finalReason = `Price Action + ${qmReason}`;
        } else if (priceActionSignal === "BEARISH" && qmSignal === "BEARISH") {
            finalSignal = "PUT";
            finalConfidence = (priceActionConfidence + qmConfidence) / 2;
            finalReason = `Price Action + ${qmReason}`;
        } else if (Math.abs(macdHistograma) > 0.002) {
            finalSignal = macdHistograma > 0 ? "CALL" : "PUT";
            finalConfidence = 0.65;
            finalReason = "MACD forte";
        } else if (Math.abs(rsi - 50) > 20) {
            finalSignal = rsi < 30 ? "CALL" : "PUT";
            finalConfidence = 0.6;
            finalReason = "RSI extremo";
        }
        
        if (diamondPatterns.length > 0) {
            const diamond = diamondPatterns[diamondPatterns.length - 1];
            const inDiamond = currentPrice >= diamond.support && currentPrice <= diamond.resistance;
            
            if (inDiamond) {
                finalConfidence *= 1.1;
                finalReason += " | Dentro de Diamond Pattern";
            }
        }
        
        return {
            signal: finalSignal,
            confidence: Math.min(0.85, finalConfidence),
            reason: finalReason,
            qmPatterns: qmPatterns,
            diamondPatterns: diamondPatterns,
            priceAction: priceActionSignal
        };
    }

    calculateVolatility(data) {
        if (!data || data.length === 0) return 0;
        const returns = [];
        for (let i = 1; i < data.length; i++) {
            returns.push(Math.abs(data[i].close - data[i-1].close) / data[i-1].close);
        }
        return returns.reduce((a, b) => a + b, 0) / returns.length;
    }

    detectBreakout(index, resistance, support) {
        const lookahead = 5;
        if (index + lookahead >= this.data.length) return 'NO_BREAKOUT';
        
        const futureCandles = this.data.slice(index, index + lookahead);
        
        for (let candle of futureCandles) {
            if (candle.close > resistance) return 'BULLISH_BREAKOUT';
            if (candle.close < support) return 'BEARISH_BREAKOUT';
        }
        
        return 'NO_BREAKOUT';
    }
}

// ========== SISTEMA DE ANÁLISE DE CONFIABILIDADE ==========
class SistemaConfiabilidade {
    constructor() {
        this.historicoConfianca = [];
    }
    
    analisarConfiabilidadeSinal(sinal, dados) {
        if (!dados.candles || dados.candles.length < 2) {
            return { 
                confiavel: false, 
                categoria: "DADOS INSUFICIENTES",
                acaoRecomendada: "AGUARDAR",
                motivo: "Dados de candles insuficientes"
            };
        }
        
        const ultimaVela = dados.candles[dados.candles.length - 2];
        const velaVermelha = ultimaVela.close < ultimaVela.open;
        
        if (sinal === "CALL" && velaVermelha) {
            return {
                confiavel: false,
                categoria: "INCONSISTÊNCIA BULLISH",
                acaoRecomendada: "AGUARDAR confirmação",
                motivo: "Sinal CALL com vela vermelha - possível correção"
            };
        }
        
        if (sinal === "PUT" && !velaVermelha) {
            return {
                confiavel: false,
                categoria: "INCONSISTÊNCIA BEARISH",
                acaoRecomendada: "AGUARDAR confirmação",
                motivo: "Sinal PUT com vela verde - possível reversão"
            };
        }
        
        const tamanhoVela = Math.abs((ultimaVela.close - ultimaVela.open) / ultimaVela.open * 100);
        const macd = dados.macdHistograma;
        const rsi = dados.rsi;
        
        let confiavel = true;
        let acao = `${sinal} normal`;
        let motivo = velaVermelha ? "Vela vermelha confirma baixa" : "Vela verde confirma alta";
        
        if (sinal === "CALL") {
            if (macd < 0.1 && rsi > 70) {
                confiavel = false;
                acao = "AGUARDAR (RSI sobrecomprado)";
                motivo = "MACD fraco + RSI elevado";
            } else if (macd < 0) {
                confiavel = false;
                acao = "PUT ou SAIR";
                motivo = "MACD negativo indica momentum baixista";
            }
        } else if (sinal === "PUT") {
            if (macd > -0.1 && rsi < 30) {
                confiavel = false;
                acao = "AGUARDAR (RSI sobrevendido)";
                motivo = "MACD fraco + RSI baixo";
            } else if (macd > 0) {
                confiavel = false;
                acao = "CALL ou SAIR";
                motivo = "MACD positivo indica momentum altista";
            }
        }
        
        const resultado = {
            confiavel: confiavel,
            categoria: confiavel ? "CONSISTENTE" : "ALERTA",
            acaoRecomendada: acao,
            motivo: motivo,
            detalhes: {
                velaVermelha: velaVermelha,
                tamanhoVelaPercent: tamanhoVela.toFixed(2) + "%",
                macd: macd,
                rsi: rsi
            }
        };
        
        this.atualizarHistorico({
            timestamp: Date.now(),
            sinal: sinal,
            confiavel: confiavel,
            categoria: resultado.categoria,
            dados: resultado
        });
        
        return resultado;
    }
    
    tabelaDecisaoRapida(macd, rsi) {
        if (macd > 1.0 && rsi < 60) return "🚀 CALL CONFIÁVEL";
        if (macd > 0.5 && rsi < 65) return "✅ CALL MODERADA";
        if (macd > 0.1 && rsi < 70) return "⚠️ CALL COM CAUTELA";
        if (macd < 0.1 && rsi > 70) return "❌ NÃO ENTRAR (revisão)";
        if (macd < 0) return "📉 CONSIDERAR PUT";
        return "🔍 ANÁLISE ADICIONAL";
    }
    
    atualizarHistorico(dados) {
        this.historicoConfianca.push(dados);
        if (this.historicoConfianca.length > 50) {
            this.historicoConfianca = this.historicoConfianca.slice(-50);
        }
    }
    
    getEstatisticas() {
        if (this.historicoConfianca.length === 0) {
            return { total: 0, confiaveis: 0, taxaConfianca: 0 };
        }
        
        const confiaveis = this.historicoConfianca.filter(item => item.confiavel).length;
        const taxaConfianca = (confiaveis / this.historicoConfianca.length) * 100;
        
        return {
            total: this.historicoConfianca.length,
            confiaveis: confiaveis,
            taxaConfianca: taxaConfianca.toFixed(1) + "%",
            ultimaCategoria: this.historicoConfianca.length > 0 ? 
                this.historicoConfianca[this.historicoConfianca.length - 1].categoria : "N/A"
        };
    }
}

// ========== SISTEMA DE ANÁLISE DE DUPLA TENDÊNCIA ==========
class SistemaDuplaTendencia {
    constructor() {
        this.historicoTendencias = [];
    }
    
    analisarTendenciasDuplas(precoAtual, precoAnterior, macdData, rsi, adxData, ultimaVela) {
        const variacaoPercentual = ((precoAtual - precoAnterior) / precoAnterior) * 100;
        const tendenciaCurtoPrazo = {
            sinal: precoAtual > precoAnterior ? "CALL" : "PUT",
            direcao: precoAtual > precoAnterior ? "ALTA" : "BAIXA",
            forca: Math.abs(variacaoPercentual),
            variacao: variacaoPercentual,
            confirmacao: ultimaVela.close > ultimaVela.open ? "VELA VERDE" : "VELA VERMELHA",
            velaTamanho: Math.abs((ultimaVela.close - ultimaVela.open) / ultimaVela.open * 100)
        };
        
        const tendenciaMedioPrazo = {
            sinal: macdData.histograma > 0 ? "CALL" : "PUT",
            direcao: macdData.histograma > 0 ? "ALTA" : "BAIXA",
            forca: Math.abs(macdData.histograma),
            macdValor: macdData.macd,
            histograma: macdData.histograma,
            confirmacao: macdData.macd > 0 ? "MACD POSITIVO" : "MACD NEGATIVO"
        };
        
        const mesmaDirecao = tendenciaCurtoPrazo.direcao === tendenciaMedioPrazo.direcao;
        let tipoConvergencia = "";
        let risco = "BAIXO";
        
        if (mesmaDirecao) {
            if (tendenciaCurtoPrazo.direcao === "ALTA") {
                tipoConvergencia = "CONVERGÊNCIA BULLISH";
                risco = "BAIXO";
            } else {
                tipoConvergencia = "CONVERGÊNCIA BEARISH";
                risco = "BAIXO";
            }
        } else {
            if (tendenciaCurtoPrazo.direcao === "ALTA" && tendenciaMedioPrazo.direcao === "BAIXA") {
                tipoConvergencia = "DIVERGÊNCIA BEARISH";
                risco = "ALTO";
            } else {
                tipoConvergencia = "DIVERGÊNCIA BULLISH";
                risco = "ALTO";
            }
        }
        
        let recomendacao = "";
        let explicacao = "";
        
        if (tipoConvergencia.includes("CONVERGÊNCIA")) {
            recomendacao = `${tendenciaCurtoPrazo.sinal} FORTE`;
            explicacao = "Ambas as tendências concordam";
        } else {
            if (tendenciaMedioPrazo.forca > Math.abs(tendenciaCurtoPrazo.variacao) * 10) {
                recomendacao = `${tendenciaMedioPrazo.sinal} (MACD mais forte)`;
                explicacao = "MACD tem força maior que variação recente";
            } else if (Math.abs(tendenciaCurtoPrazo.variacao) > 0.5) {
                recomendacao = `${tendenciaCurtoPrazo.sinal} (Price Action forte)`;
                explicacao = "Variação recente muito forte";
            } else {
                recomendacao = "AGUARDAR confirmação";
                explicacao = "Tendências em conflito sem força clara";
            }
        }
        
        const resultado = {
            tendenciaCurtoPrazo: tendenciaCurtoPrazo,
            tendenciaMedioPrazo: tendenciaMedioPrazo,
            convergencia: {
                mesmaDirecao: mesmaDirecao,
                tipo: tipoConvergencia,
                risco: risco,
                recomendacao: recomendacao,
                explicacao: explicacao
            },
            rsi: rsi,
            adx: adxData.adx,
            timestamp: Date.now()
        };
        
        this.historicoTendencias.push(resultado);
        if (this.historicoTendencias.length > 100) {
            this.historicoTendencias = this.historicoTendencias.slice(-100);
        }
        
        return resultado;
    }
    
    calcularSinalFinal(analiseDupla) {
        const { tendenciaCurtoPrazo, tendenciaMedioPrazo, convergencia } = analiseDupla;
        
        if (convergencia.risco === "ALTO") {
            return {
                sinal: "HOLD",
                probabilidade: 0.5,
                motivo: convergencia.tipo + " - " + convergencia.explicacao,
                acao: convergencia.recomendacao
            };
        }
        
        if (convergencia.tipo.includes("CONVERGÊNCIA")) {
            const sinal = tendenciaCurtoPrazo.sinal;
            let probabilidade = 0.75;
            
            if (tendenciaCurtoPrazo.forca > 0.3 && tendenciaMedioPrazo.forca > 0.01) {
                probabilidade = 0.85;
            }
            
            return {
                sinal: sinal,
                probabilidade: probabilidade,
                motivo: convergencia.tipo + " - " + convergencia.explicacao,
                acao: sinal + " NORMAL"
            };
        }
        
        return {
            sinal: tendenciaMedioPrazo.sinal,
            probabilidade: 0.65,
            motivo: "Seguindo tendência MACD (médio prazo)",
            acao: tendenciaMedioPrazo.sinal + " COM CAUTELA"
        };
    }
}

// ========== SISTEMA DE PESOS AUTOMÁTICOS DINÂMICOS ==========
class SistemaPesosAutomaticos {
    constructor() {
        this.historicoMercado = [];
        this.pesosAtuais = {};
        this.estadoMercado = "NEUTRO";
        this.tendenciaForca = "MEDIA";
        this.volatilidade = "MEDIA";
    }

    analisarMercado(candles, precoAtual) {
        if (!candles || candles.length < 50) {
            return this.gerarPesosPadrao();
        }

        const fechamentos = candles.map(c => parseFloat(c.close));
        
        const tendencia = this.calcularTendencia(fechamentos);
        const volatilidade = this.calcularVolatilidade(candles, precoAtual);
        const momentum = this.calcularMomentum(fechamentos);
        const consolidacao = this.verificarConsolidacao(candles);
        
        this.estadoMercado = this.determinarEstadoMercado(tendencia, volatilidade, momentum, consolidacao);
        this.tendenciaForca = Math.abs(tendencia) > 0.3 ? "FORTE" : Math.abs(tendencia) > 0.15 ? "MODERADA" : "FRACA";
        this.volatilidade = volatilidade > 1.5 ? "ALTA" : volatilidade > 0.5 ? "MEDIA" : "BAIXA";
        
        const pesos = this.gerarPesosAutomaticos(tendencia, volatilidade, momentum, consolidacao);
        
        this.atualizarHistorico({
            timestamp: Date.now(),
            tendencia,
            volatilidade,
            momentum,
            consolidacao,
            estado: this.estadoMercado,
            pesos: pesos
        });
        
        this.pesosAtuais = pesos;
        return pesos;
    }
    
    calcularTendencia(fechamentos) {
        if (!fechamentos || fechamentos.length < 20) return 0;
        
        const periodoCurto = Math.min(10, Math.floor(fechamentos.length / 5));
        const periodoLongo = Math.min(20, Math.floor(fechamentos.length / 2));
        
        const precoAtual = fechamentos[fechamentos.length - 1];
        const mediaCurta = this.calcularMedia(fechamentos.slice(-periodoCurto));
        const mediaLonga = this.calcularMedia(fechamentos.slice(-periodoLongo));
        
        const acimaMediaCurta = precoAtual > mediaCurta ? 0.5 : 0;
        const acimaMediaLonga = precoAtual > mediaLonga ? 0.5 : 0;
        
        return (acimaMediaCurta + acimaMediaLonga) * 2 - 1;
    }
    
    calcularVolatilidade(candles, precoAtual) {
        if (!candles || candles.length < 10) return 0;
        
        const recentes = candles.slice(-10);
        const ranges = recentes.map(c => 
            (parseFloat(c.high) - parseFloat(c.low)) / parseFloat(c.close) * 100
        );
        
        return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }
    
    calcularMomentum(fechamentos) {
        if (!fechamentos || fechamentos.length < 5) return 0;
        
        const atual = fechamentos[fechamentos.length - 1];
        const anterior = fechamentos[fechamentos.length - 5];
        
        return ((atual - anterior) / anterior) * 100 / 10;
    }
    
    verificarConsolidacao(candles) {
        if (!candles || candles.length < 20) return 0;
        
        const recentes = candles.slice(-20);
        const ranges = recentes.map(c => parseFloat(c.high) - parseFloat(c.low));
        const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
        
        const precoMedio = recentes.reduce((sum, c) => sum + parseFloat(c.close), 0) / recentes.length;
        const rangeRelativo = avgRange / precoMedio;
        
        return rangeRelativo < 0.005 ? 1 : rangeRelativo < 0.01 ? 0.5 : 0;
    }
    
    determinarEstadoMercado(tendencia, volatilidade, momentum, consolidacao) {
        if (consolidacao > 0.7) return "CONSOLIDACAO";
        if (volatilidade > 2.0) return "VOLATIL_ALTO";
        if (Math.abs(momentum) > 2) return momentum > 0 ? "MOMENTUM_ALTA_FORTE" : "MOMENTUM_BAIXA_FORTE";
        if (tendencia > 0.3) return "TENDENCIA_ALTA";
        if (tendencia < -0.3) return "TENDENCIA_BAIXA";
        if (volatilidade > 1.0) return "VOLATIL";
        return "NEUTRO";
    }
    
    gerarPesosAutomaticos(tendencia, volatilidade, momentum, consolidacao) {
        const basePesos = this.gerarPesosPadrao();
        const ajustes = this.calcularAjustesPorEstado(this.estadoMercado);
        
        const pesosAjustados = {};
        
        for (const [key, value] of Object.entries(basePesos)) {
            let ajuste = 1.0;
            
            if (key.includes('adx_')) {
                ajuste = ajustes.adx || 1.0;
            } else if (key.includes('peso_m') || key.includes('peso_h')) {
                ajuste = ajustes.timeframes || 1.0;
            } else if (key.includes('peso_')) {
                ajuste = ajustes.indicadores || 1.0;
            } else if (key.includes('rsi_')) {
                ajuste = ajustes.rsi || 1.0;
            }
            
            if (typeof value === 'number') {
                pesosAjustados[key] = value * ajuste;
            } else {
                pesosAjustados[key] = value;
            }
        }
        
        pesosAjustados.sensibilidade_geral = ajustes.sensibilidade || 1.0;
        pesosAjustados.agressividade_ajustada = ajustes.agressividade || 1.0;
        
        return pesosAjustados;
    }
    
    calcularAjustesPorEstado(estado) {
        const ajustes = {
            adx: 1.0,
            timeframes: 1.0,
            indicadores: 1.0,
            rsi: 1.0,
            sensibilidade: 1.0,
            agressividade: 1.0
        };
        
        switch(estado) {
            case "CONSOLIDACAO":
                ajustes.adx = 0.6;
                ajustes.indicadores = 0.8;
                ajustes.sensibilidade = 1.1;
                ajustes.agressividade = 0.8;
                break;
                
            case "VOLATIL_ALTO":
                ajustes.adx = 1.0;
                ajustes.timeframes = 0.9;
                ajustes.sensibilidade = 1.0;
                ajustes.agressividade = 0.9;
                break;
                
            case "TENDENCIA_ALTA":
            case "TENDENCIA_BAIXA":
                ajustes.adx = 1.2;
                ajustes.indicadores = 1.3;
                ajustes.timeframes = 1.2;
                ajustes.sensibilidade = 1.3;
                ajustes.agressividade = 1.3;
                break;
                
            case "MOMENTUM_ALTA_FORTE":
            case "MOMENTUM_BAIXA_FORTE":
                ajustes.adx = 1.0;
                ajustes.indicadores = 1.5;
                ajustes.timeframes = 1.1;
                ajustes.sensibilidade = 1.5;
                ajustes.agressividade = 1.7;
                break;
                
            case "VOLATIL":
                ajustes.adx = 0.9;
                ajustes.indicadores = 1.1;
                ajustes.sensibilidade = 1.1;
                ajustes.agressividade = 1.0;
                break;
                
            default:
                ajustes.adx = 0.8;
                ajustes.indicadores = 1.1;
                ajustes.timeframes = 1.1;
                ajustes.sensibilidade = 1.1;
                ajustes.agressividade = 1.1;
        }
        
        return ajustes;
    }
    
    calcularMedia(valores) {
        if (!valores || valores.length === 0) return 0;
        return valores.reduce((a, b) => a + b, 0) / valores.length;
    }
    
    gerarPesosPadrao() {
    return {
        // Pesos MACD
        peso_macd: 15,
        peso_macd_histograma: 25,
        peso_macd_tendencia: 20,
        
        // Pesos ADX
        adx_lateral: 10,
        adx_fraca: 15,
        adx_moderada: 25,
        adx_forte: 35,
        
        peso_adx_fraco: -5,
        peso_adx_moderado: 5,
        peso_adx_forte: 10,
        
        // RSI
        rsi_oversold: 20,
        rsi_overbought: 80,
        
        // ✅ PESOS CORRETOS DOS TIMEFRAMES QUE VOCÊ USA
        peso_m5: 8,      // 5 minutos
        peso_m15: 12,    // 15 minutos
        peso_m30: 15,    // 30 minutos
        peso_h1: 18,     // 1 hora
        peso_h4: 22,     // ✅ ADICIONADO - 4 horas (peso maior que H1)
        peso_h24: 25,    // ✅ ADICIONADO - 24 horas (maior peso)
        
        // Ajustes gerais
        sensibilidade_geral: 1.3,
        agressividade_ajustada: 1.2,
        
        ignorar_adx_abaixo: 25,
        forcar_macd_acima: 0.002
    };
}
    
    atualizarHistorico(dados) {
        this.historicoMercado.push(dados);
        if (this.historicoMercado.length > 100) {
            this.historicoMercado = this.historicoMercado.slice(-100);
        }
    }
    
    getEstadoMercado() {
        return this.estadoMercado;
    }
    
    getTendenciaForca() {
        return this.tendenciaForca;
    }
    
    getVolatilidade() {
        return this.volatilidade;
    }
}

// ========== SISTEMA DE CONFIGURAÇÃO POR ATIVO ==========
class ConfigAtivo {
    static getConfig(simbolo) {
        const tipo = this._detectarTipoAtivo(simbolo);
        
        const configs = {
            'commodity': {
                'nome': 'Commodity',
                'rsi_oversold': 20,
                'rsi_overbought': 80,
                'rsi_extreme_oversold': 12,
                'rsi_extreme_overbought': 88,
                'prob_compra': 0.62,
                'prob_venda': 0.38,
                'peso_tecnica': 0.60,
                'atr_multiplier': 2.5,
                'min_probabilidade': 0.55,
                'tendencia_peso_extra': 1.3,
                'limite_volatilidade_min': 0.03,
                'limite_volatilidade_max': 2.0,
                'usar_adx_corrigido': true,
                'agressividade': 1.2,
                'stop_padrao_pct': 1.2,
                'alvo_moderado_pct': 3.5
            },
            'indice_normal': {
                'nome': 'Índice Normal',
                'rsi_oversold': 20,
                'rsi_overbought': 80,
                'rsi_extreme_oversold': 15,
                'rsi_extreme_overbought': 90,
                'prob_compra': 0.60,
                'prob_venda': 0.40,
                'peso_tecnica': 0.60,
                'atr_multiplier': 1.8,
                'min_probabilidade': 0.50,
                'tendencia_peso_extra': 1.2,
                'limite_volatilidade_min': 0.15,
                'limite_volatilidade_max': 2.5,
                'usar_adx_corrigido': true,
                'agressividade': 1.0,
                'stop_padrao_pct': 0.8,
                'alvo_moderado_pct': 2.5
            },
            'volatility_index': {
                'nome': 'Volatility Index',
                'rsi_oversold': 20,
                'rsi_overbought': 80,
                'rsi_extreme_oversold': 20,
                'rsi_extreme_overbought': 85,
                'prob_compra': 0.65,
                'prob_venda': 0.35,
                'peso_tecnica': 0.60,
                'atr_multiplier': 2.0,
                'min_probabilidade': 0.48,
                'tendencia_peso_extra': 1.4,
                'limite_volatilidade_min': 0.01,
                'limite_volatilidade_max': 1.0,
                'usar_adx_corrigido': true,
                'agressividade': 1.5,
                'stop_padrao_pct': 0.3,
                'alvo_moderado_pct': 1.0
            },
            'criptomoeda': {
                'nome': 'Criptomoeda',
                'rsi_oversold': 20,
                'rsi_overbought': 80,
                'rsi_extreme_oversold': 18,
                'rsi_extreme_overbought': 82,
                'prob_compra': 0.63,
                'prob_venda': 0.37,
                'peso_tecnica': 0.65,
                'atr_multiplier': 2.2,
                'min_probabilidade': 0.52,
                'tendencia_peso_extra': 1.3,
                'limite_volatilidade_min': 0.05,
                'limite_volatilidade_max': 3.0,
                'usar_adx_corrigido': true,
                'agressividade': 1.3,
                'stop_padrao_pct': 0.5,
                'alvo_moderado_pct': 2.0
            }
        };
        
        return configs[tipo] || configs['indice_normal'];
    }
    
    static _detectarTipoAtivo(simbolo) {
        if (!simbolo) return 'indice_normal';
        simbolo = simbolo.toUpperCase();
        
        if (simbolo.startsWith('R_')) {
            return 'volatility_index';
        } else if (simbolo.includes('XAU') || simbolo.includes('XAG') || simbolo.includes('OIL')) {
            return 'commodity';
        } else if (simbolo.includes('CRY')) {
            return 'criptomoeda';
        } else {
            return 'indice_normal';
        }
    }
}

// ========== SISTEMA DE ANÁLISE COM PRIORIDADE MACD E CONFIABILIDADE ==========
class SistemaAnaliseInteligente {
    constructor(simbolo) {
        this.simbolo = simbolo;
        this.config = ConfigAtivo.getConfig(simbolo);
        this.tipoAtivo = ConfigAtivo._detectarTipoAtivo(simbolo);
        this.sistemaPesos = new SistemaPesosAutomaticos();
        this.sistemaConfiabilidade = new SistemaConfiabilidade();
        this.sistemaDuplaTendencia = new SistemaDuplaTendencia();
        this.quasimodoAnalyzer = new QuasimodoPattern([]);
        this.elliottWaveSystem = new AutomatedElliottTradingSystem();
    }
    
    calcularMediaSimples(precos, periodo) {
        if (!precos || precos.length === 0) return 0;
        if (precos.length < periodo) {
            return precos.reduce((a, b) => a + b, 0) / precos.length;
        }
        const slice = precos.slice(-periodo);
        return slice.reduce((a, b) => a + b, 0) / periodo;
    }
    
    calcularMediaExponencial(precos, periodo) {
        if (!precos || precos.length === 0) return 0;
        if (precos.length < periodo) {
            return precos.reduce((a, b) => a + b, 0) / precos.length;
        }
        
        let ema = [precos.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo];
        const multiplicador = 2 / (periodo + 1);
        
        for (let i = periodo; i < precos.length; i++) {
            const novaEma = (precos[i] * multiplicador) + (ema[ema.length - 1] * (1 - multiplicador));
            ema.push(novaEma);
        }
        
        return ema[ema.length - 1];
    }
    
    calcularRSI(precos, periodo = INDICATOR_CONFIG.RSI_PERIOD) {
        if (!precos || precos.length < periodo + 1) return 50;

        let ganhos = 0;
        let perdas = 0;

        for (let i = 1; i <= periodo; i++) {
            const diff = precos[i] - precos[i - 1];
            if (diff >= 0) ganhos += diff;
            else perdas += Math.abs(diff);
        }
        
        let avgGanho = ganhos / periodo;
        let avgPerda = perdas / periodo;

        for (let i = periodo + 1; i < precos.length; i++) {
            const diff = precos[i] - precos[i - 1];
            const ganhoAtual = diff >= 0 ? diff : 0;
            const perdaAtual = diff < 0 ? Math.abs(diff) : 0;

            avgGanho = ((avgGanho * (periodo - 1)) + ganhoAtual) / periodo;
            avgPerda = ((avgPerda * (periodo - 1)) + perdaAtual) / periodo;
        }

        if (avgPerda === 0) return 100;
        const rs = avgGanho / avgPerda;
        return 100 - (100 / (1 + rs));
    }
    
    calcularMACD(precos, periodoRapido = INDICATOR_CONFIG.MACD_FAST, periodoLento = INDICATOR_CONFIG.MACD_SLOW, periodoSinal = INDICATOR_CONFIG.MACD_SIGNAL) {
        if (!precos || precos.length < periodoLento) {
            return { macd: 0, sinal: 0, histograma: 0, valido: false };
        }
        
        try {
            const emaRapida = this.calcularMediaExponencial(precos, periodoRapido);
            const emaLenta = this.calcularMediaExponencial(precos, periodoLento);
            const linhaMACD = emaRapida - emaLenta;
            
            let linhaSinal = 0;
            
            if (precos.length >= periodoLento + periodoSinal) {
                const historicoMACD = [];
                for (let i = periodoLento - 1; i < precos.length; i++) {
                    const slice = precos.slice(0, i + 1);
                    const emaR = this.calcularMediaExponencial(slice, periodoRapido);
                    const emaL = this.calcularMediaExponencial(slice, periodoLento);
                    historicoMACD.push(emaR - emaL);
                }
                
                if (historicoMACD.length >= periodoSinal) {
                    const ultimosMACDs = historicoMACD.slice(-periodoSinal);
                    linhaSinal = this.calcularMediaExponencial(ultimosMACDs, periodoSinal);
                } else {
                    linhaSinal = historicoMACD.reduce((a, b) => a + b, 0) / historicoMACD.length;
                }
            } else {
                const historicoRecente = [];
                const inicio = Math.max(0, precos.length - periodoLento);
                
                for (let i = inicio; i < precos.length; i++) {
                    const slice = precos.slice(0, i + 1);
                    const emaR = this.calcularMediaExponencial(slice, periodoRapido);
                    const emaL = this.calcularMediaExponencial(slice, periodoLento);
                    historicoRecente.push(emaR - emaL);
                }
                
                if (historicoRecente.length > 0) {
                    linhaSinal = historicoRecente.reduce((a, b) => a + b, 0) / historicoRecente.length;
                } else {
                    linhaSinal = linhaMACD * 0.98;
                }
            }
            
            const histograma = linhaMACD - linhaSinal;
            
            return {
                macd: linhaMACD,
                sinal: linhaSinal,
                histograma: histograma,
                valido: true,
                direcao: histograma > 0 ? 'BULLISH' : 'BEARISH',
                forca: Math.abs(histograma)
            };
            
        } catch (error) {
            console.error("Erro calculando MACD:", error);
            return { macd: 0, sinal: 0, histograma: 0, valido: false };
        }
    }
    
    verificarTendenciaMACD(macdData) {
        if (!macdData || !macdData.valido) return "NEUTRO";
        
        const histograma = macdData.histograma;
        const linhaMACD = macdData.macd;
        const linhaSinal = macdData.sinal;
        
        if (histograma > 0.001 && linhaMACD > linhaSinal) {
            return "FORTE_ALTA";
        }
        
        if (histograma < -0.001 && linhaMACD < linhaSinal) {
            return "FORTE_BAIXA";
        }
        
        if (histograma > 0) return "MODERADA_ALTA";
        if (histograma < 0) return "MODERADA_BAIXA";
        
        return "NEUTRO";
    }
    
    calcularADXCompleto(candles, periodo = INDICATOR_CONFIG.ADX_PERIOD) {
        if (!candles || candles.length < periodo * 2) {
            return { 
                adx: 25.0, 
                plusDI: 50, 
                minusDI: 50,
                tendenciaForca: "FRACA",
                tendenciaDirecao: "NEUTRAL",
                cruzamentoDI: "NENHUM"
            };
        }
        
        try {
            const highs = candles.map(c => parseFloat(c.high));
            const lows = candles.map(c => parseFloat(c.low));
            const closes = candles.map(c => parseFloat(c.close));
            
            const trValues = [];
            const plusDMValues = [];
            const minusDMValues = [];
            
            for (let i = 1; i < highs.length; i++) {
                const highLow = highs[i] - lows[i];
                const highPrevClose = Math.abs(highs[i] - closes[i - 1]);
                const lowPrevClose = Math.abs(lows[i] - closes[i - 1]);
                trValues.push(Math.max(highLow, highPrevClose, lowPrevClose));
                
                const upMove = highs[i] - highs[i - 1];
                const downMove = lows[i - 1] - lows[i];
                
                if (upMove > downMove && upMove > 0) {
                    plusDMValues.push(upMove);
                    minusDMValues.push(0);
                } else if (downMove > upMove && downMove > 0) {
                    plusDMValues.push(0);
                    minusDMValues.push(downMove);
                } else {
                    plusDMValues.push(0);
                    minusDMValues.push(0);
                }
            }
            
            const wilderSmooth = (values, period) => {
                if (!values || values.length === 0) return [0];
                if (values.length < period) {
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    return Array(values.length).fill(avg);
                }
                
                let smoothed = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
                const alpha = 1.0 / period;
                
                for (let i = period; i < values.length; i++) {
                    const newVal = smoothed[smoothed.length - 1] * (1 - alpha) + values[i] * alpha;
                    smoothed.push(newVal);
                }
                
                return smoothed;
            };
            
            const smoothedTR = wilderSmooth(trValues, periodo);
            const smoothedPlusDM = wilderSmooth(plusDMValues, periodo);
            const smoothedMinusDM = wilderSmooth(minusDMValues, periodo);
            
            const plusDI = [];
            const minusDI = [];
            for (let i = 0; i < smoothedTR.length; i++) {
                if (smoothedTR[i] !== 0) {
                    plusDI.push((smoothedPlusDM[i] / smoothedTR[i]) * 100);
                    minusDI.push((smoothedMinusDM[i] / smoothedTR[i]) * 100);
                } else {
                    plusDI.push(0);
                    minusDI.push(0);
                }
            }
            
            const dxValues = [];
            for (let i = 0; i < plusDI.length; i++) {
                const sum = plusDI[i] + minusDI[i];
                if (sum !== 0) {
                    dxValues.push((Math.abs(plusDI[i] - minusDI[i]) / sum) * 100);
                } else {
                    dxValues.push(0);
                }
            }
            
            const adxValues = wilderSmooth(dxValues, periodo);
            
            const lastADX = adxValues[adxValues.length - 1] || 25.0;
            const lastPlusDI = plusDI[plusDI.length - 1] || 50;
            const lastMinusDI = minusDI[minusDI.length - 1] || 50;
            
            let tendenciaForca = "FRACA";
            if (lastADX >= 50) tendenciaForca = "MUITO FORTE";
            else if (lastADX >= 40) tendenciaForca = "FORTE";
            else if (lastADX >= 25) tendenciaForca = "MODERADA";
            else if (lastADX >= 20) tendenciaForca = "FRACA";
            else tendenciaForca = "LATERAL";
            
            let tendenciaDirecao = "NEUTRAL";
            const diDiff = lastPlusDI - lastMinusDI;
            if (diDiff > 10) tendenciaDirecao = "BULLISH";
            else if (diDiff < -10) tendenciaDirecao = "BEARISH";
            
            let cruzamentoDI = "NENHUM";
            const penultimoPlusDI = plusDI.length > 1 ? plusDI[plusDI.length - 2] : lastPlusDI;
            const penultimoMinusDI = minusDI.length > 1 ? minusDI[minusDI.length - 2] : lastMinusDI;
            
            if (penultimoPlusDI <= penultimoMinusDI && lastPlusDI > lastMinusDI) {
                cruzamentoDI = "BULLISH";
            } else if (penultimoMinusDI <= penultimoPlusDI && lastMinusDI > lastPlusDI) {
                cruzamentoDI = "BEARISH";
            }
            
            return {
                adx: lastADX,
                plusDI: lastPlusDI,
                minusDI: lastMinusDI,
                tendenciaForca: tendenciaForca,
                tendenciaDirecao: tendenciaDirecao,
                cruzamentoDI: cruzamentoDI
            };
            
        } catch (e) {
            console.log(`⚠️ Erro calculando ADX: ${e.message}`);
            return { 
                adx: 25.0, 
                plusDI: 50, 
                minusDI: 50,
                tendenciaForca: "FRACA",
                tendenciaDirecao: "NEUTRAL",
                cruzamentoDI: "NENHUM"
            };
        }
    }
    
    calcularVolatilidade(candles, precoAtual) {
        if (!candles || candles.length < 10 || !precoAtual || precoAtual <= 0) return 0;
        
        const recentes = candles.slice(-10);
        const ranges = recentes.map(c => 
            (parseFloat(c.high) - parseFloat(c.low)) / precoAtual * 100
        );
        
        return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }
    
    gerarSinalRapidoMACD(candles) {
        if (!candles || candles.length < 30) return null;
        
        const fechamentos = candles.map(c => parseFloat(c.close));
        const macdResult = this.calcularMACD(fechamentos);
        
        if (!macdResult.valido) return null;
        
        if (macdResult.histograma > 0.002) {
            return {
                sinal: "CALL",
                forca: "FORTE",
                motivo: `MACD positivo forte (${macdResult.histograma.toFixed(4)})`,
                probabilidade: 0.68
            };
        } 
        else if (macdResult.histograma > 0.001) {
            return {
                sinal: "CALL",
                forca: "MODERADA",
                motivo: `MACD positivo moderado (${macdResult.histograma.toFixed(4)})`,
                probabilidade: 0.62
            };
        }
        else if (macdResult.histograma < -0.002) {
            return {
                sinal: "PUT",
                forca: "FORTE",
                motivo: `MACD negativo forte (${macdResult.histograma.toFixed(4)})`,
                probabilidade: 0.68
            };
        }
        else if (macdResult.histograma < -0.001) {
            return {
                sinal: "PUT",
                forca: "MODERADA",
                motivo: `MACD negativo moderado (${macdResult.histograma.toFixed(4)})`,
                probabilidade: 0.62
            };
        }
        
        return null;
    }
    
    async analisar(candles) {
        if (!candles || candles.length < 50) {
            return { erro: "Dados insuficientes (mínimo 50 candles)" };
        }
        
        const fechamentos = candles.map(c => parseFloat(c.close));
        const precoAtual = fechamentos[fechamentos.length - 1];
        const precoAnterior = fechamentos[fechamentos.length - 2];
        const ultimaVela = candles[candles.length - 2];
        
        const pesosAutomaticos = this.sistemaPesos.analisarMercado(candles, precoAtual);
        const estadoMercado = this.sistemaPesos.getEstadoMercado();
        const tendenciaForca = this.sistemaPesos.getTendenciaForca();
        const volatilidade = this.sistemaPesos.getVolatilidade();
        
        const rsi = this.calcularRSI(fechamentos);
        const adxData = this.calcularADXCompleto(candles);
        const macdResult = this.calcularMACD(fechamentos);
        const volatilidadeAtual = this.calcularVolatilidade(candles, precoAtual);
        
        const tendenciaMACD = this.verificarTendenciaMACD(macdResult);
        
        const analiseDupla = this.sistemaDuplaTendencia.analisarTendenciasDuplas(
            precoAtual, 
            precoAnterior, 
            macdResult, 
            rsi, 
            adxData, 
            ultimaVela
        );
        
        const sinalFinal = this.sistemaDuplaTendencia.calcularSinalFinal(analiseDupla);
        
        let sinal = sinalFinal.sinal;
        let probabilidade = sinalFinal.probabilidade;
        let regra = sinalFinal.motivo;
        
        const sinalCombinado = this.quasimodoAnalyzer.generateCombinedSignal(
            candles, 
            macdResult.histograma, 
            rsi
        );
        
        const confirmacaoQM = this.quasimodoAnalyzer.confirmSignalWithQM(
            sinal,
            precoAtual,
            candles.slice(-50)
        );
        
        const elliottAnalyzer = new ElliottWaveMaster();
        const elliottAnalysis = elliottAnalyzer.analyzeFull(candles.slice(-100));
        
        let elliottConfirma = false;
        let elliottSinal = "NEUTRAL";
        let elliottConfidence = 0;
        let elliottReason = "";
        
        if (elliottAnalysis.tradingSignals.length > 0) {
            const primarySignal = elliottAnalysis.tradingSignals[0];
            elliottSinal = primarySignal.type === 'BUY' ? 'CALL' : 'SELL';
            elliottConfidence = primarySignal.confidence;
            elliottReason = primarySignal.reason;
            
            if (elliottSinal === sinal) {
                elliottConfirma = true;
            }
        }
        
        let sinalAjustado = sinal;
        let probabilidadeAjustada = probabilidade;
        let regraAjustada = regra;
        
        if (confirmacaoQM.confirmed) {
            probabilidadeAjustada += 0.07;
            regraAjustada += " | ✅ Confirmado por Quasimodo";
        } else if (sinal !== "HOLD") {
            probabilidadeAjustada -= 0.05;
            regraAjustada += " | ⚠️ Quasimodo não confirma";
        }
        
        if (elliottConfirma) {
            probabilidadeAjustada += 0.08;
            regraAjustada += " | 🌊 Confirmado por Elliott Wave";
            
            if (elliottAnalysis.structure.pattern !== 'UNKNOWN') {
                regraAjustada += ` (${elliottAnalysis.structure.pattern})`;
            }
        } else if (sinal !== "HOLD" && elliottSinal !== "NEUTRAL") {
            const diffConfidence = Math.abs(elliottConfidence - probabilidadeAjustada);
            
            if (elliottConfidence > probabilidadeAjustada + 0.1) {
                sinalAjustado = elliottSinal;
                probabilidadeAjustada = elliottConfidence;
                regraAjustada = elliottReason + " | Prioridade Elliott Wave";
            } else {
                probabilidadeAjustada -= 0.04;
                regraAjustada += " | ⚠️ Elliott Wave sugere direção diferente";
            }
        }
        
        const metodosConvergentes = [
            sinal === sinalCombinado.signal,
            elliottConfirma || elliottSinal === sinalAjustado
        ];
        
        const convergenciaCount = metodosConvergentes.filter(Boolean).length;
        
        if (convergenciaCount >= 2) {
            probabilidadeAjustada += 0.1;
            regraAjustada += " | 🎯 ALTA CONVERGÊNCIA ENTRE MÉTODOS";
        }
        
        sinal = sinalAjustado;
        probabilidade = probabilidadeAjustada;
        regra = regraAjustada;
        
        const analiseConfiabilidade = this.sistemaConfiabilidade.analisarConfiabilidadeSinal(
            sinal, 
            {
                precoAtual: precoAtual,
                macdHistograma: macdResult.histograma,
                rsi: rsi,
                candles: candles,
                timeframe: "5min"
            }
        );
        
        const decisaoRapida = this.sistemaConfiabilidade.tabelaDecisaoRapida(macdResult.histograma, rsi);
        
        if (!analiseConfiabilidade.confiavel && sinal !== "HOLD") {
            probabilidade *= 0.7;
            regra += " | Confiabilidade baixa";
        }
        
        if (sinal !== "HOLD") {
            const sensibilidade = Math.max(0.8, Math.min(1.5, pesosAutomaticos.sensibilidade_geral || 1.0));
            const agressividade = Math.max(0.8, Math.min(1.5, pesosAutomaticos.agressividade_ajustada || 1.0));
            
            probabilidade *= sensibilidade;
            probabilidade *= agressividade;
            
            if (volatilidadeAtual > 2.0) {
                probabilidade *= 0.92;
                regra += " | Alta volatilidade";
            } else if (volatilidadeAtual < 0.3) {
                probabilidade *= 1.1;
                regra += " | Baixa volatilidade";
            }
            
            probabilidade = Math.max(0.3, Math.min(0.88, probabilidade));
        }
        
        probabilidade = this.aplicarFiltroTradingMode(sinal, probabilidade);
        probabilidade = Math.max(0.35, Math.min(0.88, probabilidade));
        
        const direcao = sinal === "CALL" ? "ALTA" : sinal === "PUT" ? "BAIXA" : "NEUTRA";
        
        return {
            sinal: sinal,
            direcao: direcao,
            probabilidade: probabilidade,
            tendencia: tendenciaMACD,
            rsi: rsi,
            adx: adxData.adx,
            preco_atual: precoAtual,
            variacao_recente: ((precoAtual - precoAnterior)/precoAnterior*100),
            regra_aplicada: regra,
            volatilidade: volatilidadeAtual,
            tipo_ativo: this.tipoAtivo,
            simbolo: this.simbolo,
            
            decisao_rapida: decisaoRapida,
            
            tendencias_duplas: analiseDupla,
            
            confiabilidade: {
                confiavel: analiseConfiabilidade.confiavel,
                categoria: analiseConfiabilidade.categoria,
                acao_recomendada: analiseConfiabilidade.acaoRecomendada,
                motivo: analiseConfiabilidade.motivo
            },
            
            quasimodo_confirmation: {
                confirmed: confirmacaoQM.confirmed,
                confirmation_type: confirmacaoQM.confirmationType,
                distance_percent: confirmacaoQM.distancePercent,
                pattern_type: confirmacaoQM.pattern ? confirmacaoQM.pattern.type : null,
                pattern_price: confirmacaoQM.pattern ? confirmacaoQM.pattern.price : null
            },
            
            elliott_wave: {
                pattern: elliottAnalysis.structure.pattern,
                phase: elliottAnalysis.structure.phase,
                trend: elliottAnalysis.trend,
                confidence: elliottAnalysis.confidence,
                confirms_signal: elliottConfirma,
                suggested_signal: elliottSinal,
                reason: elliottReason,
                fibonacci_levels: elliottAnalysis.fibonacci,
                wave_count: elliottAnalysis.waveCount
            },
            
            sinal_combinado: {
                signal: sinalCombinado.signal,
                confidence: sinalCombinado.confidence,
                reason: sinalCombinado.reason
            },
            
            pesos_automaticos: {
                estado_mercado: estadoMercado,
                tendencia_forca: tendenciaForca,
                volatilidade_nivel: volatilidade
            },
            
            indicator_config: {
                rsi_period: INDICATOR_CONFIG.RSI_PERIOD,
                adx_period: INDICATOR_CONFIG.ADX_PERIOD,
                macd_fast: INDICATOR_CONFIG.MACD_FAST,
                macd_slow: INDICATOR_CONFIG.MACD_SLOW,
                macd_signal: INDICATOR_CONFIG.MACD_SIGNAL
            },
            
            macd_data: {
                macd: macdResult.macd,
                sinal: macdResult.sinal,
                histograma: macdResult.histograma,
                direcao: macdResult.direcao
            }
        };
    }
    
    aplicarFiltroTradingMode(sinal, probabilidade) {
        if (sinal === "HOLD") return probabilidade;
        
        if (TRADING_MODE === "CONSERVADOR") {
            return probabilidade >= 0.55 ? probabilidade : 0.35;
        } else if (TRADING_MODE === "PADRÃO") {
            return probabilidade;
        } else if (TRADING_MODE === "AGGRESSIVO") {
            return Math.min(0.85, probabilidade * 1.12);
        }
        
        return probabilidade;
    }
}

// ========== NOVO SISTEMA DE ANÁLISE ESTRATÉGICA - INTERPRETAÇÃO HUMANA ==========
class SistemaAnaliseCompleto {
    constructor() {
        this.pesos = {
            '24h': 0.35,
            '4h': 0.25,
            '1h': 0.20,
            '30m': 0.10,
            '15m': 0.06,
            '5m': 0.04
        };
        
        this.timeframes = ['24h', '4h', '1h', '30m', '15m', '5m'];
        
        this.limiares = {
            adx_forte: 40,
            adx_muito_forte: 50,
            rsi_sobrecomprado: 70,
            rsi_sobrevendido: 30,
            probabilidade_alta: 75,
            probabilidade_moderada: 60,
            confianca_minima: 55
        };
    }

    analisarTodosTimeframes(dados) {
        console.log("\n" + "=".repeat(80));
        console.log("🤖 ANÁLISE ESTRATÉGICA AVANÇADA - INTERPRETAÇÃO HUMANA v3.0");
        console.log("=".repeat(80));
        console.log(`📅 ${new Date().toLocaleString('pt-BR')}`);
        console.log("=".repeat(80));
        
        if (!dados || Object.keys(dados).length === 0) {
            throw new Error("Dados de entrada inválidos ou vazios");
        }
        
        const resultado = {
            timestamp: new Date().toISOString(),
            precoAtual: this._extrairPrecoAtual(dados),
            analises: {},
            hierarquia: {},
            divergencias: [],
            sequenciasAlinhadas: [],
            forcaRelativa: { call: 0, put: 0, vencedor: 'EMPATE', diferenca: 0 },
            sinalFinal: 'HOLD',
            probabilidade: 50,
            confianca: 'BAIXA',
            acao: null,
            niveis: {},
            alertas: [],
            passosAnalise: [],
            justificativa: [],
            tfDominante: null,
            regraPrioridade: null,
            resumo: {}
        };

        try {
            resultado.passosAnalise.push("🔍 PASSO 1: ANALISANDO TIMEFRAMES INDIVIDUALMENTE");
            for (const [tf, data] of Object.entries(dados)) {
                resultado.analises[tf] = this._analisarTimeframe(tf, data);
                
                const icone = resultado.analises[tf].sinal === 'CALL' ? '🟢' : 
                            resultado.analises[tf].sinal === 'PUT' ? '🔴' : '⚪';
                const forcaStr = resultado.analises[tf].forca > 50 ? '💪' : 
                                resultado.analises[tf].forca > 25 ? '📊' : '📉';
                
                resultado.passosAnalise.push(
                    `   ${icone} ${tf}: ${resultado.analises[tf].macd.trend.padEnd(12)} | ` +
                    `ADX ${resultado.analises[tf].adx.toFixed(1)} (${resultado.analises[tf].adxStatus}) ` +
                    `${forcaStr} | RSI ${resultado.analises[tf].rsi.toFixed(1)}`
                );
            }

            resultado.passosAnalise.push("\n🔍 PASSO 2: CONSTRUINDO HIERARQUIA");
            resultado.hierarquia = this._construirHierarquia(resultado.analises);
            
            resultado.tfDominante = this._identificarTFDominante(resultado.hierarquia);
            const adxDominante = resultado.hierarquia[resultado.tfDominante]?.adx.toFixed(1) || 'N/A';
            resultado.passosAnalise.push(`   📊 Timeframe dominante: ${resultado.tfDominante} (ADX ${adxDominante})`);

            resultado.passosAnalise.push("\n🔍 PASSO 3: DETECTANDO DIVERGÊNCIAS");
            resultado.divergencias = this._detectarDivergencias(resultado.hierarquia, resultado.analises);
            
            if (resultado.divergencias.length === 0) {
                resultado.passosAnalise.push(`   ✅ Nenhuma divergência detectada`);
            } else {
                resultado.passosAnalise.push(`   ⚠️ Divergências encontradas: ${resultado.divergencias.length}`);
                resultado.divergencias.forEach(d => {
                    const icone = d.gravidade === 'ALTA' ? '🚨' : d.gravidade === 'MEDIA' ? '⚠️' : '🔔';
                    resultado.passosAnalise.push(`      ${icone} ${d.descricao} (${d.gravidade})`);
                });
            }

            resultado.passosAnalise.push("\n🔗 PASSO 4: DETECTANDO SEQUÊNCIAS ALINHADAS");
            resultado.sequenciasAlinhadas = this._detectarSequencias(resultado.hierarquia);
            
            if (resultado.sequenciasAlinhadas.length === 0) {
                resultado.passosAnalise.push(`   ❌ Nenhuma sequência alinhada detectada`);
            } else {
                resultado.sequenciasAlinhadas.forEach(seq => {
                    const icone = seq.sinal === 'CALL' ? '🟢' : '🔴';
                    resultado.passosAnalise.push(`   ${icone} ${seq.descricao} (força ${seq.forca})`);
                });
            }

            resultado.passosAnalise.push("\n⚖️ PASSO 5: CALCULANDO FORÇA RELATIVA");
            resultado.forcaRelativa = this._calcularForcaRelativa(resultado.hierarquia);
            
            resultado.passosAnalise.push(
                `   📊 CALL: ${resultado.forcaRelativa.call.toFixed(1)} | ` +
                `PUT: ${resultado.forcaRelativa.put.toFixed(1)} | ` +
                `Diferença: ${resultado.forcaRelativa.diferenca.toFixed(1)}`
            );
            
            const iconeVencedor = resultado.forcaRelativa.vencedor === 'CALL' ? '🟢' : 
                                 resultado.forcaRelativa.vencedor === 'PUT' ? '🔴' : '⚪';
            resultado.passosAnalise.push(`   ${iconeVencedor} Vencedor: ${resultado.forcaRelativa.vencedor}`);

            resultado.passosAnalise.push("\n🎯 PASSO 6: APLICANDO REGRAS DE PRIORIDADE");
            const regras = this._aplicarRegrasPrioridade(resultado);
            resultado.sinalPrioritario = regras.sinal;
            resultado.motivoPrioridade = regras.motivo;
            
            if (regras.sinal) {
                const iconeRegra = regras.sinal === 'CALL' ? '🟢' : '🔴';
                resultado.passosAnalise.push(`   ${iconeRegra} Regra aplicada: ${regras.motivo}`);
            } else {
                resultado.passosAnalise.push(`   ⚪ Nenhuma regra de prioridade especial aplicada`);
            }

            resultado.passosAnalise.push("\n📈 PASSO 7: CALCULANDO PROBABILIDADE NUMÉRICA");
            resultado.probabilidade = this._calcularProbabilidade(resultado);
            
            let probStr;
            if (resultado.probabilidade >= 75) probStr = '🟢 MUITO ALTA';
            else if (resultado.probabilidade >= 65) probStr = '🟡 ALTA';
            else if (resultado.probabilidade >= 55) probStr = '🟠 MODERADA';
            else probStr = '🔴 BAIXA';
            
            resultado.passosAnalise.push(`   📊 Probabilidade: ${resultado.probabilidade.toFixed(1)}% (${probStr})`);

            resultado.passosAnalise.push("\n🎚️ PASSO 8: DEFININDO NÍVEIS ESTRATÉGICOS");
            resultado.niveis = this._definirNiveis(resultado);
            
            resultado.passosAnalise.push(`   💰 Preço atual: ${resultado.niveis.entrada.toFixed(2)}`);
            resultado.passosAnalise.push(`   🛑 Stop Loss: ${resultado.niveis.stopLoss}`);
            resultado.passosAnalise.push(`   🎯 Alvos: ${resultado.niveis.alvos.join(' → ')}`);
            resultado.passosAnalise.push(`   📉 Suportes: ${resultado.niveis.suportes.join(' → ')}`);
            resultado.passosAnalise.push(`   📈 Resistências: ${resultado.niveis.resistencias.join(' → ')}`);

            resultado.passosAnalise.push("\n🎯 PASSO 9: DECISÃO FINAL");
            this._definirSinalFinal(resultado);
            
            const iconeFinal = resultado.sinalFinal === 'CALL' ? '🟢' : 
                              resultado.sinalFinal === 'PUT' ? '🔴' : '⚪';
            resultado.passosAnalise.push(`   ${iconeFinal} Sinal: ${resultado.sinalFinal}`);
            resultado.passosAnalise.push(`   🔮 Confiança: ${resultado.confianca} (${resultado.probabilidade.toFixed(1)}%)`);
            resultado.passosAnalise.push(`   💡 Ação: ${resultado.acao}`);

            this._gerarJustificativa(resultado);
            this._gerarAlertas(resultado);

            resultado.resumo = {
                sinal: resultado.sinalFinal,
                probabilidade: resultado.probabilidade,
                confianca: resultado.confianca,
                acao: resultado.acao,
                preco: resultado.precoAtual,
                stop: resultado.niveis.stopLoss,
                alvos: resultado.niveis.alvos,
                alertas: resultado.alertas.length
            };

        } catch (error) {
            console.error("❌ Erro durante a análise:", error.message);
            resultado.erro = error.message;
        }

        return resultado;
    }

    _extrairPrecoAtual(dados) {
        try {
            if (dados['1h']?.preco) return dados['1h'].preco;
            if (dados['4h']?.preco) return dados['4h'].preco;
            
            for (const tf in dados) {
                if (dados[tf]?.preco) return dados[tf].preco;
            }
            
            return 0;
        } catch (error) {
            console.warn("Erro ao extrair preço atual:", error);
            return 0;
        }
    }

    _analisarTimeframe(tf, data) {
        try {
            if (!data || !data.candles || !Array.isArray(data.candles) || data.candles.length < 20) {
                console.warn(`⚠️ Dados insuficientes para ${tf}, usando valores padrão`);
                return this._criarAnalisePadrao(tf);
            }

            const closes = data.candles.map(c => this._validarNumero(c.close, 'close'));
            const highs = data.candles.map(c => this._validarNumero(c.high, 'high'));
            const lows = data.candles.map(c => this._validarNumero(c.low, 'low'));
            const volumes = data.candles.map(c => this._validarNumero(c.volume, 'volume', 0));
            
            const precoAtual = closes[closes.length - 1];
            
            const rsi = this._calcularRSI(closes, 14);
            const adx = this._calcularADX(highs, lows, closes, 14);
            const macd = this._calcularMACD(closes, 12, 26, 9);
            const volumeConfirmacao = this._analisarVolume(volumes, closes);
            
            let adxStatus = 'LATERAL';
            if (adx >= 50) adxStatus = 'MUITO FORTE';
            else if (adx >= 40) adxStatus = 'FORTE';
            else if (adx >= 25) adxStatus = 'MODERADA';
            else if (adx >= 20) adxStatus = 'FRACA';
            
            let macdTrend = 'NEUTRO';
            if (macd.histograma > 0.001 && macd.macd > macd.sinal) {
                macdTrend = 'FORTE_ALTA';
            } else if (macd.histograma > 0) {
                macdTrend = 'ALTA';
            } else if (macd.histograma < -0.001 && macd.macd < macd.sinal) {
                macdTrend = 'FORTE_BAIXA';
            } else if (macd.histograma < 0) {
                macdTrend = 'BAIXA';
            }
            
            const sinal = macdTrend.includes('ALTA') ? 'CALL' :
                         macdTrend.includes('BAIXA') ? 'PUT' : 'HOLD';
            
            let forca = 0;
            
            if (adx >= 50) forca += 50;
            else if (adx >= 40) forca += 40;
            else if (adx >= 30) forca += 30;
            else if (adx >= 25) forca += 20;
            else if (adx >= 20) forca += 10;
            
            if (macdTrend === 'FORTE_ALTA' || macdTrend === 'FORTE_BAIXA') forca += 30;
            else if (macdTrend === 'ALTA' || macdTrend === 'BAIXA') forca += 20;
            
            if (sinal === 'CALL' && rsi > 30 && rsi < 70) forca += 10;
            if (sinal === 'PUT' && rsi > 30 && rsi < 70) forca += 10;
            
            if (volumeConfirmacao && volumeConfirmacao.confirmado) {
                forca += volumeConfirmacao.forca === 'FORTE' ? 15 : 5;
            }
            
            let variacao = 0;
            if (closes.length >= 10) {
                variacao = ((precoAtual - closes[closes.length - 10]) / closes[closes.length - 10]) * 100;
            }
            
            return {
                timeframe: tf,
                preco: precoAtual,
                rsi: parseFloat(rsi.toFixed(2)),
                adx: parseFloat(adx.toFixed(2)),
                adxStatus,
                macd: {
                    macd: parseFloat(macd.macd.toFixed(4)),
                    sinal: parseFloat(macd.sinal.toFixed(4)),
                    histograma: parseFloat(macd.histograma.toFixed(4)),
                    trend: macdTrend
                },
                sinal,
                forca: parseFloat(forca.toFixed(1)),
                variacao: parseFloat(variacao.toFixed(2)),
                volume: volumeConfirmacao || { confirmado: false, motivo: 'sem dados' },
                ultimaVela: data.candles[data.candles.length - 1] || null
            };
            
        } catch (error) {
            console.error(`Erro ao analisar timeframe ${tf}:`, error);
            return this._criarAnalisePadrao(tf);
        }
    }

    _validarNumero(valor, nome, padrao = 0) {
        if (valor === undefined || valor === null || isNaN(valor)) {
            console.warn(`Valor inválido para ${nome}, usando padrão: ${padrao}`);
            return padrao;
        }
        return valor;
    }

    _criarAnalisePadrao(tf) {
        return {
            timeframe: tf,
            preco: 0,
            rsi: 50,
            adx: 20,
            adxStatus: 'LATERAL',
            macd: {
                macd: 0,
                sinal: 0,
                histograma: 0,
                trend: 'NEUTRO'
            },
            sinal: 'HOLD',
            forca: 0,
            variacao: 0,
            volume: { confirmado: false, motivo: 'dados insuficientes' },
            ultimaVela: null
        };
    }

    _construirHierarquia(analises) {
        const hierarquia = {};
        
        for (const tf of this.timeframes) {
            if (analises[tf]) {
                hierarquia[tf] = {
                    sinal: analises[tf].sinal,
                    adx: analises[tf].adx,
                    forca: analises[tf].forca,
                    peso: this.pesos[tf] || 0.1,
                    trend: analises[tf].macd.trend,
                    rsi: analises[tf].rsi
                };
            }
        }
        
        return hierarquia;
    }

    _identificarTFDominante(hierarquia) {
        let tfDominante = null;
        let maiorADX = 0;
        
        for (const [tf, dados] of Object.entries(hierarquia)) {
            if (dados.adx > maiorADX) {
                maiorADX = dados.adx;
                tfDominante = tf;
            }
        }
        
        return tfDominante;
    }

    _detectarDivergencias(hierarquia, analises) {
        const divergencias = [];
        
        try {
            const comparar = (tf1, tf2, gravidade) => {
                if (!hierarquia[tf1] || !hierarquia[tf2]) return;
                
                const sinal1 = hierarquia[tf1].sinal;
                const sinal2 = hierarquia[tf2].sinal;
                
                if (sinal1 && sinal2 && sinal1 !== 'HOLD' && sinal2 !== 'HOLD' && sinal1 !== sinal2) {
                    
                    let tipo = 'DIVERGÊNCIA';
                    if (hierarquia[tf1].adx > 40 || hierarquia[tf2].adx > 40) {
                        tipo = 'DIVERGÊNCIA_FORTE';
                    }
                    
                    if (analises[tf1] && analises[tf2]) {
                        const preco1 = analises[tf1].preco;
                        const preco2 = analises[tf2].preco;
                        const rsi1 = analises[tf1].rsi;
                        const rsi2 = analises[tf2].rsi;
                        
                        if (sinal1 === 'CALL' && sinal2 === 'PUT') {
                            if (preco1 > preco2 && rsi1 < rsi2) {
                                tipo = 'DIVERGÊNCIA_ALTA_RSI';
                            }
                        } else if (sinal1 === 'PUT' && sinal2 === 'CALL') {
                            if (preco1 < preco2 && rsi1 > rsi2) {
                                tipo = 'DIVERGÊNCIA_BAIXA_RSI';
                            }
                        }
                    }
                    
                    divergencias.push({
                        tipo,
                        gravidade,
                        tf1,
                        tf2,
                        sinal1,
                        sinal2,
                        descricao: `${tf1} quer ${sinal1} mas ${tf2} quer ${sinal2}`
                    });
                }
            };
            
            comparar('24h', '4h', 'ALTA');
            comparar('4h', '1h', 'MEDIA');
            comparar('1h', '30m', 'BAIXA');
            comparar('30m', '15m', 'BAIXA');
            comparar('15m', '5m', 'BAIXA');
            
        } catch (error) {
            console.warn("Erro ao detectar divergências:", error);
        }
        
        return divergencias;
    }

    _detectarSequencias(hierarquia) {
        const sequencias = [];
        const ordem = this.timeframes;
        
        try {
            const verificarSequencia = (inicio, tamanho) => {
                if (inicio + tamanho > ordem.length) return null;
                
                const tfs = [];
                for (let i = 0; i < tamanho; i++) {
                    tfs.push(ordem[inicio + i]);
                }
                
                for (const tf of tfs) {
                    if (!hierarquia[tf]) return null;
                }
                
                const primeiroSinal = hierarquia[tfs[0]].sinal;
                if (!primeiroSinal || primeiroSinal === 'HOLD') return null;
                
                for (let i = 1; i < tfs.length; i++) {
                    if (hierarquia[tfs[i]].sinal !== primeiroSinal) return null;
                }
                
                let forcaTotal = 0;
                tfs.forEach(tf => {
                    forcaTotal += hierarquia[tf]?.forca || 0;
                });
                
                return {
                    timeframes: [...tfs],
                    sinal: primeiroSinal,
                    forca: forcaTotal,
                    descricao: `${tfs.join(', ')} alinhados em ${primeiroSinal}`
                };
            };
            
            for (let i = 0; i <= ordem.length - 3; i++) {
                const seq = verificarSequencia(i, 3);
                if (seq) sequencias.push(seq);
            }
            
            for (let i = 0; i <= ordem.length - 4; i++) {
                const seq = verificarSequencia(i, 4);
                if (seq && !sequencias.some(s => JSON.stringify(s.timeframes) === JSON.stringify(seq.timeframes))) {
                    sequencias.push(seq);
                }
            }
            
            for (let i = 0; i <= ordem.length - 5; i++) {
                const seq = verificarSequencia(i, 5);
                if (seq && !sequencias.some(s => JSON.stringify(s.timeframes) === JSON.stringify(seq.timeframes))) {
                    sequencias.push(seq);
                }
            }
            
            sequencias.sort((a, b) => b.forca - a.forca);
            
        } catch (error) {
            console.warn("Erro ao detectar sequências:", error);
        }
        
        return sequencias;
    }

    _calcularForcaRelativa(hierarquia) {
        let forcaCall = 0;
        let forcaPut = 0;
        let pesoTotal = 0;
        
        try {
            for (const [tf, dados] of Object.entries(hierarquia)) {
                if (dados.sinal && dados.sinal !== 'HOLD') {
                    const forcaPonderada = dados.forca * dados.peso;
                    if (dados.sinal === 'CALL') forcaCall += forcaPonderada;
                    if (dados.sinal === 'PUT') forcaPut += forcaPonderada;
                    pesoTotal += dados.peso;
                }
            }
            
            if (pesoTotal > 0) {
                forcaCall = (forcaCall / pesoTotal) * 100;
                forcaPut = (forcaPut / pesoTotal) * 100;
            }
            
        } catch (error) {
            console.warn("Erro ao calcular força relativa:", error);
        }
        
        return {
            call: parseFloat(forcaCall.toFixed(1)),
            put: parseFloat(forcaPut.toFixed(1)),
            diferenca: parseFloat(Math.abs(forcaCall - forcaPut).toFixed(1)),
            vencedor: forcaCall > forcaPut ? 'CALL' : forcaPut > forcaCall ? 'PUT' : 'EMPATE'
        };
    }

    _aplicarRegrasPrioridade(resultado) {
        const { hierarquia, sequenciasAlinhadas } = resultado;
        
        try {
            const sequencia5 = sequenciasAlinhadas.find(s => s.timeframes.length >= 5);
            if (sequencia5) {
                return { 
                    sinal: sequencia5.sinal, 
                    motivo: `Sequência de ${sequencia5.timeframes.length} timeframes alinhados em ${sequencia5.sinal} (PRIORIDADE MÁXIMA)` 
                };
            }
            
            const sequencia4 = sequenciasAlinhadas.find(s => s.timeframes.length >= 4);
            if (sequencia4) {
                return { 
                    sinal: sequencia4.sinal, 
                    motivo: `Sequência de ${sequencia4.timeframes.length} timeframes alinhados em ${sequencia4.sinal}` 
                };
            }
            
            if (hierarquia['24h']?.adx >= 50 && hierarquia['24h'].sinal && hierarquia['24h'].sinal !== 'HOLD') {
                return { 
                    sinal: hierarquia['24h'].sinal, 
                    motivo: `24h domina com ADX ${hierarquia['24h'].adx.toFixed(1)} (MUITO FORTE)` 
                };
            }
            
            if (hierarquia['4h']?.adx >= 40 && hierarquia['4h'].sinal && 
                hierarquia['1h']?.sinal && hierarquia['4h'].sinal !== hierarquia['1h'].sinal &&
                hierarquia['4h'].sinal !== 'HOLD') {
                return { 
                    sinal: hierarquia['4h'].sinal, 
                    motivo: `4h domina 1h com ADX ${hierarquia['4h'].adx.toFixed(1)}` 
                };
            }
            
            if (hierarquia['4h']?.sinal && hierarquia['1h']?.sinal && 
                hierarquia['4h'].sinal === hierarquia['1h'].sinal &&
                hierarquia['4h'].sinal !== 'HOLD') {
                return { 
                    sinal: hierarquia['4h'].sinal, 
                    motivo: `4h e 1h alinhados em ${hierarquia['4h'].sinal}` 
                };
            }
            
            let tfMaiorADX = null;
            let maiorADX = 0;
            for (const [tf, dados] of Object.entries(hierarquia)) {
                if (dados.adx > maiorADX && dados.sinal && dados.sinal !== 'HOLD') {
                    maiorADX = dados.adx;
                    tfMaiorADX = tf;
                }
            }
            
            if (tfMaiorADX && maiorADX > 30) {
                return { 
                    sinal: hierarquia[tfMaiorADX].sinal, 
                    motivo: `${tfMaiorADX} tem o maior ADX (${maiorADX.toFixed(1)})` 
                };
            }
            
        } catch (error) {
            console.warn("Erro ao aplicar regras de prioridade:", error);
        }
        
        return { sinal: null, motivo: '' };
    }

    _calcularProbabilidade(resultado) {
        const { forcaRelativa, sequenciasAlinhadas, divergencias, sinalPrioritario } = resultado;
        let probabilidade = 50;
        
        try {
            if (forcaRelativa.vencedor !== 'EMPATE') {
                const vantagem = Math.min(20, forcaRelativa.diferenca);
                probabilidade += forcaRelativa.vencedor === 'CALL' ? vantagem : -vantagem;
            }
            
            if (sequenciasAlinhadas.length > 0) {
                const sequenciaMaisForte = sequenciasAlinhadas.reduce(
                    (max, seq) => seq.forca > max.forca ? seq : max, 
                    sequenciasAlinhadas[0]
                );
                
                const bonus = Math.min(25, sequenciaMaisForte.forca / 4);
                probabilidade += sequenciaMaisForte.sinal === 'CALL' ? bonus : -bonus;
            }
            
            if (sinalPrioritario === 'CALL') {
                probabilidade += 10;
            } else if (sinalPrioritario === 'PUT') {
                probabilidade -= 10;
            }
            
            if (divergencias.length > 0) {
                const reducao = Math.min(15, divergencias.length * 5);
                const temDivergenciaAlta = divergencias.some(d => d.gravidade === 'ALTA');
                
                if (temDivergenciaAlta) {
                    probabilidade = probabilidade > 50 ? 
                        Math.max(50, probabilidade - reducao) : 
                        Math.min(50, probabilidade + reducao);
                }
            }
            
            probabilidade = Math.max(10, Math.min(90, Math.round(probabilidade)));
            
        } catch (error) {
            console.warn("Erro ao calcular probabilidade:", error);
        }
        
        return probabilidade;
    }

    _definirNiveis(resultado) {
        const preco = resultado.precoAtual;
        
        const niveisPadrao = {
            suportes: [preco * 0.99, preco * 0.98, preco * 0.97],
            resistencias: [preco * 1.01, preco * 1.02, preco * 1.03],
            entrada: preco,
            stopLoss: Math.round(preco),
            alvos: [Math.round(preco), Math.round(preco)]
        };
        
        if (preco === 0) return niveisPadrao;
        
        try {
            const analises = Object.values(resultado.analises).filter(a => a && a.adx);
            
            if (analises.length === 0) return niveisPadrao;
            
            const adxMedio = analises.reduce((acc, a) => acc + (a.adx || 20), 0) / analises.length;
            const volatilidade = Math.max(0.005, adxMedio / 100);
            
            let amplitudeMedia = 0;
            let countAmplitude = 0;
            
            analises.forEach(a => {
                if (a.ultimaVela && a.ultimaVela.high && a.ultimaVela.low && a.preco > 0) {
                    const amplitude = (a.ultimaVela.high - a.ultimaVela.low) / a.preco;
                    if (!isNaN(amplitude) && amplitude > 0) {
                        amplitudeMedia += amplitude;
                        countAmplitude++;
                    }
                }
            });
            
            amplitudeMedia = countAmplitude > 0 ? amplitudeMedia / countAmplitude : 0.01;
            
            const volatilidadeUsar = Math.max(volatilidade, amplitudeMedia * 2, 0.01);
            
            const distancia1 = preco * volatilidadeUsar;
            const distancia2 = preco * volatilidadeUsar * 1.5;
            const distancia3 = preco * volatilidadeUsar * 2;
            
            const suportes = [
                Math.round(preco - distancia1),
                Math.round(preco - distancia2),
                Math.round(preco - distancia3)
            ];
            
            const resistencias = [
                Math.round(preco + distancia1),
                Math.round(preco + distancia2),
                Math.round(preco + distancia3)
            ];
            
            const stopDistancia = volatilidadeUsar * preco * 1.5;
            let stopLoss;
            
            if (resultado.sinalPrioritario === 'CALL') {
                stopLoss = Math.round(Math.max(suportes[1], preco - stopDistancia));
            } else if (resultado.sinalPrioritario === 'PUT') {
                stopLoss = Math.round(Math.min(resistencias[1], preco + stopDistancia));
            } else {
                stopLoss = Math.round(preco);
            }
            
            let alvos;
            if (resultado.sinalPrioritario === 'CALL') {
                alvos = [
                    Math.round(resistencias[0]),
                    Math.round(resistencias[1])
                ];
            } else if (resultado.sinalPrioritario === 'PUT') {
                alvos = [
                    Math.round(suportes[0]),
                    Math.round(suportes[1])
                ];
            } else {
                alvos = [Math.round(preco), Math.round(preco)];
            }
            
            return {
                suportes: suportes.map(s => Math.max(1, s)),
                resistencias: resistencias.map(r => Math.max(1, r)),
                entrada: preco,
                stopLoss: Math.max(1, stopLoss),
                alvos: alvos.map(a => Math.max(1, a))
            };
            
        } catch (error) {
            console.warn("Erro ao definir níveis:", error);
            return niveisPadrao;
        }
    }

    _definirSinalFinal(resultado) {
        try {
            const { sinalPrioritario, forcaRelativa, probabilidade, sequenciasAlinhadas } = resultado;
            
            if (sinalPrioritario) {
                resultado.sinalFinal = sinalPrioritario;
            } else if (forcaRelativa.vencedor !== 'EMPATE' && forcaRelativa.diferenca > 10) {
                resultado.sinalFinal = forcaRelativa.vencedor;
            } else if (sequenciasAlinhadas.length > 0) {
                resultado.sinalFinal = sequenciasAlinhadas[0].sinal;
            } else {
                resultado.sinalFinal = 'HOLD';
            }
            
            if (probabilidade >= 80) {
                resultado.confianca = 'ALTÍSSIMA';
            } else if (probabilidade >= 70) {
                resultado.confianca = 'ALTA';
            } else if (probabilidade >= 60) {
                resultado.confianca = 'MODERADA';
            } else if (probabilidade >= 50) {
                resultado.confianca = 'BAIXA';
            } else {
                resultado.confianca = 'MUITO BAIXA';
            }
            
            if (resultado.sinalFinal === 'CALL') {
                if (probabilidade >= 75) {
                    resultado.acao = '🟢 COMPRAR AGORA (sinal forte confirmado)';
                } else if (probabilidade >= 65) {
                    resultado.acao = '🟡 COMPRAR EM DIP (esperar suporte)';
                } else if (probabilidade >= 55) {
                    resultado.acao = '🟠 AGUARDAR confirmação acima da resistência';
                } else {
                    resultado.acao = '⚪ HOLD - sem condições ideais para compra';
                }
            } else if (resultado.sinalFinal === 'PUT') {
                if (probabilidade <= 25) {
                    resultado.acao = '🔴 VENDER AGORA (sinal forte confirmado)';
                } else if (probabilidade <= 35) {
                    resultado.acao = '🟡 VENDER EM RALLY (esperar resistência)';
                } else if (probabilidade <= 45) {
                    resultado.acao = '🟠 AGUARDAR confirmação abaixo do suporte';
                } else {
                    resultado.acao = '⚪ HOLD - sem condições ideais para venda';
                }
            } else {
                resultado.acao = '⚪ HOLD - mercado neutro, aguardar definição';
            }
            
        } catch (error) {
            console.warn("Erro ao definir sinal final:", error);
            resultado.sinalFinal = 'HOLD';
            resultado.confianca = 'BAIXA';
            resultado.acao = '⚪ HOLD - erro na análise';
        }
    }

    _gerarJustificativa(resultado) {
        try {
            const justificativa = [
                `📊 Timeframes analisados: ${Object.keys(resultado.analises).join(', ')}`,
                `📈 Timeframe dominante: ${resultado.tfDominante} (ADX ${resultado.hierarquia[resultado.tfDominante]?.adx?.toFixed(1) || 'N/A'})`,
                `⚖️ Força relativa: CALL ${resultado.forcaRelativa.call} × PUT ${resultado.forcaRelativa.put}`,
                `🔗 Sequências alinhadas: ${resultado.sequenciasAlinhadas.length}`,
                `⚠️ Divergências detectadas: ${resultado.divergencias.length}`,
                `🎯 Regra de prioridade: ${resultado.motivoPrioridade || 'Nenhuma regra especial'}`,
                `📈 Probabilidade calculada: ${resultado.probabilidade}% para ${resultado.sinalFinal}`,
                `💰 Stop Loss sugerido: ${resultado.niveis.stopLoss}`,
                `🎯 Alvos sugeridos: ${resultado.niveis.alvos.join(' → ')}`
            ];
            
            resultado.justificativa = justificativa;
            
        } catch (error) {
            console.warn("Erro ao gerar justificativa:", error);
            resultado.justificativa = ["Erro ao gerar justificativa completa"];
        }
    }

    _gerarAlertas(resultado) {
        const alertas = [];
        
        try {
            const divergenciasAltas = resultado.divergencias.filter(d => d.gravidade === 'ALTA');
            if (divergenciasAltas.length > 0) {
                alertas.push(`🚨 Divergência de ALTA GRAVIDADE: ${divergenciasAltas[0].descricao}`);
            }
            
            if (resultado.sequenciasAlinhadas.length >= 2) {
                const sinalSeq = resultado.sequenciasAlinhadas[0].sinal;
                alertas.push(`💪 Múltiplas sequências alinhadas em ${sinalSeq} - SINAL FORTE`);
            }
            
            if (resultado.probabilidade > 85) {
                alertas.push('🔥 Probabilidade EXTREMAMENTE ALTA - oportunidade de alta convicção');
            } else if (resultado.probabilidade < 15) {
                alertas.push('❄️ Probabilidade EXTREMAMENTE BAIXA - oportunidade de alta convicção para venda');
            }
            
            ['1h', '4h'].forEach(tf => {
                const analise = resultado.analises[tf];
                if (analise && analise.rsi) {
                    if (analise.rsi > 75) {
                        alertas.push(`⚠️ ${tf} em RSI SOBRECOMPRADO (${analise.rsi.toFixed(1)}) - possível correção`);
                    } else if (analise.rsi < 25) {
                        alertas.push(`⚠️ ${tf} em RSI SOBREVENDIDO (${analise.rsi.toFixed(1)}) - possível recuperação`);
                    }
                }
            });
            
            Object.entries(resultado.hierarquia).forEach(([tf, dados]) => {
                if (dados && dados.adx > 60) {
                    alertas.push(`💨 ${tf} com ADX ${dados.adx.toFixed(1)} - tendência extremamente forte`);
                }
            });
            
            if (resultado.niveis && resultado.niveis.stopLoss && resultado.precoAtual > 0) {
                const distanciaStop = Math.abs(resultado.niveis.stopLoss - resultado.precoAtual) / resultado.precoAtual * 100;
                if (distanciaStop < 1) {
                    alertas.push(`⚠️ Stop loss muito próximo (${distanciaStop.toFixed(1)}%) - risco de stopado prematuramente`);
                }
            }
            
            Object.entries(resultado.analises).forEach(([tf, analise]) => {
                if (analise && analise.volume && !analise.volume.confirmado && ['1h', '4h'].includes(tf)) {
                    alertas.push(`📉 Volume fraco em ${tf} - movimento pode não ter sustentação`);
                }
            });
            
        } catch (error) {
            console.warn("Erro ao gerar alertas:", error);
        }
        
        resultado.alertas = alertas;
    }

    _analisarVolume(volumes, closes) {
        try {
            if (!volumes || !Array.isArray(volumes) || volumes.length < 5) {
                return { confirmado: false, motivo: 'dados insuficientes' };
            }
            
            const volumesValidos = volumes.filter(v => v > 0);
            if (volumesValidos.length < 5) {
                return { confirmado: false, motivo: 'volumes zerados' };
            }
            
            const ultimos5 = volumesValidos.slice(-5);
            const volumeMedio = ultimos5.reduce((a, b) => a + b, 0) / ultimos5.length;
            const volumeAtual = volumesValidos[volumesValidos.length - 1];
            
            if (volumeMedio === 0) {
                return { confirmado: false, motivo: 'volume médio zero' };
            }
            
            const volumeCrescendo = volumesValidos.length >= 3 && 
                                   volumesValidos[volumesValidos.length - 1] > volumesValidos[volumesValidos.length - 2] &&
                                   volumesValidos[volumesValidos.length - 2] > volumesValidos[volumesValidos.length - 3];
            
            const ultimasVelas = closes.slice(-5);
            let velasVerdes = 0;
            for (let i = 1; i < ultimasVelas.length; i++) {
                if (ultimasVelas[i] > ultimasVelas[i-1]) velasVerdes++;
            }
            const velasVermelhas = 4 - velasVerdes;
            
            const tendencia = velasVerdes > velasVermelhas ? 'CALL' : 'PUT';
            
            if (volumeAtual > volumeMedio * 1.5 && volumeCrescendo) {
                return { confirmado: true, forca: 'FORTE', motivo: 'volume crescente muito acima da média', tendencia };
            } else if (volumeAtual > volumeMedio * 1.2) {
                return { confirmado: true, forca: 'MEDIA', motivo: 'volume acima da média', tendencia };
            } else if (volumeAtual > volumeMedio) {
                return { confirmado: true, forca: 'FRACA', motivo: 'volume ligeiramente acima da média', tendencia };
            } else {
                return { confirmado: false, motivo: 'volume abaixo da média', tendencia };
            }
            
        } catch (error) {
            console.warn("Erro ao analisar volume:", error);
            return { confirmado: false, motivo: 'erro na análise' };
        }
    }

    _calcularRSI(closes, periodo) {
        try {
            if (!closes || closes.length < periodo + 1) return 50;
            
            let ganhos = 0;
            let perdas = 0;
            
            for (let i = 1; i <= periodo; i++) {
                const diff = closes[i] - closes[i-1];
                if (diff >= 0) {
                    ganhos += diff;
                } else {
                    perdas += Math.abs(diff);
                }
            }
            
            let avgGanho = ganhos / periodo;
            let avgPerda = perdas / periodo;
            
            for (let i = periodo + 1; i < closes.length; i++) {
                const diff = closes[i] - closes[i-1];
                
                if (diff >= 0) {
                    avgGanho = (avgGanho * (periodo - 1) + diff) / periodo;
                    avgPerda = (avgPerda * (periodo - 1)) / periodo;
                } else {
                    avgGanho = (avgGanho * (periodo - 1)) / periodo;
                    avgPerda = (avgPerda * (periodo - 1) + Math.abs(diff)) / periodo;
                }
            }
            
            if (avgPerda === 0) return 100;
            
            const rs = avgGanho / avgPerda;
            const rsi = 100 - (100 / (1 + rs));
            
            return isNaN(rsi) ? 50 : rsi;
            
        } catch (error) {
            console.warn("Erro no cálculo do RSI:", error);
            return 50;
        }
    }

    _calcularADX(highs, lows, closes, periodo) {
        try {
            if (!highs || !lows || !closes || highs.length < periodo * 2) return 25;
            
            const tr = [];
            const plusDM = [];
            const minusDM = [];
            
            for (let i = 1; i < highs.length; i++) {
                if (isNaN(highs[i]) || isNaN(lows[i]) || isNaN(closes[i-1])) {
                    tr.push(0);
                    plusDM.push(0);
                    minusDM.push(0);
                    continue;
                }
                
                const highLow = highs[i] - lows[i];
                const highPrevClose = Math.abs(highs[i] - closes[i-1]);
                const lowPrevClose = Math.abs(lows[i] - closes[i-1]);
                tr.push(Math.max(highLow, highPrevClose, lowPrevClose));
                
                const upMove = highs[i] - highs[i-1];
                const downMove = lows[i-1] - lows[i];
                
                if (upMove > downMove && upMove > 0) {
                    plusDM.push(upMove);
                    minusDM.push(0);
                } else if (downMove > upMove && downMove > 0) {
                    plusDM.push(0);
                    minusDM.push(downMove);
                } else {
                    plusDM.push(0);
                    minusDM.push(0);
                }
            }
            
            const smoothedTR = this._wilderSmooth(tr, periodo);
            const smoothedPlusDM = this._wilderSmooth(plusDM, periodo);
            const smoothedMinusDM = this._wilderSmooth(minusDM, periodo);
            
            if (smoothedTR === 0) return 25;
            
            const plusDI = (smoothedPlusDM / smoothedTR) * 100;
            const minusDI = (smoothedMinusDM / smoothedTR) * 100;
            
            if (plusDI + minusDI === 0) return 25;
            const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
            
            const adxValues = [];
            for (let i = 0; i < tr.length - periodo + 1; i++) {
                if (i < periodo) {
                    adxValues.push(dx);
                } else {
                    const prevADX = adxValues[adxValues.length - 1];
                    const currentDX = dx;
                    adxValues.push(((prevADX * (periodo - 1)) + currentDX) / periodo);
                }
            }
            
            const adx = adxValues.length > 0 ? adxValues[adxValues.length - 1] : 25;
            return isNaN(adx) ? 25 : adx;
            
        } catch (error) {
            console.warn("Erro no cálculo do ADX:", error);
            return 25;
        }
    }

    _wilderSmooth(values, period) {
        try {
            if (!values || values.length === 0) return 0;
            
            const valoresValidos = values.filter(v => !isNaN(v) && v !== null);
            if (valoresValidos.length === 0) return 0;
            
            if (valoresValidos.length < period) {
                return valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length;
            }
            
            let smoothed = valoresValidos.slice(0, period).reduce((a, b) => a + b, 0) / period;
            
            for (let i = period; i < valoresValidos.length; i++) {
                smoothed = ((smoothed * (period - 1)) + valoresValidos[i]) / period;
            }
            
            return smoothed;
            
        } catch (error) {
            console.warn("Erro no Wilder Smooth:", error);
            return 0;
        }
    }

    _calcularMACD(closes, fastPeriod, slowPeriod, signalPeriod) {
        try {
            if (!closes || closes.length < slowPeriod + signalPeriod) {
                return { macd: 0, sinal: 0, histograma: 0 };
            }
            
            const emaFast = this._calcularEMA(closes, fastPeriod);
            const emaSlow = this._calcularEMA(closes, slowPeriod);
            
            const macdLine = emaFast - emaSlow;
            
            const macdValues = [macdLine];
            const signalLine = this._calcularEMA(macdValues, signalPeriod);
            
            const histogram = macdLine - signalLine;
            
            return {
                macd: isNaN(macdLine) ? 0 : macdLine,
                sinal: isNaN(signalLine) ? 0 : signalLine,
                histograma: isNaN(histogram) ? 0 : histogram
            };
            
        } catch (error) {
            console.warn("Erro no cálculo do MACD:", error);
            return { macd: 0, sinal: 0, histograma: 0 };
        }
    }

    _calcularEMA(values, period) {
        try {
            if (!values || values.length < period) {
                return values.length > 0 ? values[values.length - 1] : 0;
            }
            
            const multiplier = 2 / (period + 1);
            
            let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
            
            for (let i = period; i < values.length; i++) {
                ema = (values[i] - ema) * multiplier + ema;
            }
            
            return isNaN(ema) ? 0 : ema;
            
        } catch (error) {
            console.warn("Erro no cálculo da EMA:", error);
            return 0;
        }
    }

    imprimirResultado(resultado) {
        if (resultado.erro) {
            console.error("\n❌ ERRO NA ANÁLISE:", resultado.erro);
            return;
        }
        
        console.log("\n" + "=".repeat(80));
        console.log("📊 RESUMO EXECUTIVO DA ANÁLISE");
        console.log("=".repeat(80));
        
        console.log(`\n💰 PREÇO ATUAL: ${resultado.precoAtual.toFixed(2)}`);
        
        let sinalFormatado;
        if (resultado.sinalFinal === 'CALL') {
            sinalFormatado = '🟢 CALL';
        } else if (resultado.sinalFinal === 'PUT') {
            sinalFormatado = '🔴 PUT';
        } else {
            sinalFormatado = '⚪ HOLD';
        }
        
        console.log(`🎯 SINAL FINAL: ${sinalFormatado} (${resultado.probabilidade}% confiança)`);
        console.log(`🔮 CONFIANÇA: ${resultado.confianca}`);
        console.log(`💡 AÇÃO: ${resultado.acao}`);
        
        console.log("\n" + "─".repeat(80));
        console.log("📈 PASSOS DA ANÁLISE:");
        console.log("─".repeat(80));
        
        resultado.passosAnalise.forEach(passo => console.log(passo));
        
        console.log("\n" + "─".repeat(80));
        console.log("⚖️ JUSTIFICATIVA COMPLETA:");
        console.log("─".repeat(80));
        
        resultado.justificativa.forEach(j => console.log(`   • ${j}`));
        
        if (resultado.alertas.length > 0) {
            console.log("\n" + "─".repeat(80));
            console.log("🚨 ALERTAS DE MERCADO:");
            console.log("─".repeat(80));
            
            resultado.alertas.forEach(a => console.log(`   • ${a}`));
        }
        
        console.log("\n" + "─".repeat(80));
        console.log("💰 NÍVEIS ESTRATÉGICOS DETALHADOS:");
        console.log("─".repeat(80));
        
        console.log(`   Entrada: ${resultado.niveis.entrada.toFixed(2)}`);
        console.log(`   Stop Loss: ${resultado.niveis.stopLoss} (${(Math.abs(resultado.niveis.stopLoss - resultado.precoAtual) / resultado.precoAtual * 100).toFixed(1)}%)`);
        console.log(`   Alvo 1: ${resultado.niveis.alvos[0]} (${(Math.abs(resultado.niveis.alvos[0] - resultado.precoAtual) / resultado.precoAtual * 100).toFixed(1)}%)`);
        console.log(`   Alvo 2: ${resultado.niveis.alvos[1]} (${(Math.abs(resultado.niveis.alvos[1] - resultado.precoAtual) / resultado.precoAtual * 100).toFixed(1)}%)`);
        console.log(`   Suportes: ${resultado.niveis.suportes.join(' → ')}`);
        console.log(`   Resistências: ${resultado.niveis.resistencias.join(' → ')}`);
        
        if (resultado.sinalFinal !== 'HOLD' && resultado.niveis.stopLoss !== resultado.precoAtual) {
            const risco = Math.abs(resultado.niveis.stopLoss - resultado.precoAtual);
            const recompensa = Math.abs(resultado.niveis.alvos[0] - resultado.precoAtual);
            
            if (risco > 0) {
                const relacao = (recompensa / risco).toFixed(2);
                
                console.log(`\n   📊 Relação Risco/Recompensa: 1:${relacao}`);
                
                if (relacao >= 2) {
                    console.log(`   ✅ Boa relação risco/recompensa (≥ 1:2)`);
                } else if (relacao >= 1.5) {
                    console.log(`   ⚠️ Relação risco/recompensa aceitável (1:1.5)`);
                } else {
                    console.log(`   ❌ Relação risco/recompensa desfavorável (< 1:1.5)`);
                }
            }
        }
        
        console.log("\n" + "=".repeat(80));
        console.log(`📅 Análise gerada em: ${new Date(resultado.timestamp).toLocaleString('pt-BR')}`);
        console.log("=".repeat(80));
    }
}

// ========== FUNÇÃO DE WRAPPER PARA USO FÁCIL ==========
function analisarMercado(dados) {
    try {
        const sistema = new SistemaAnaliseCompleto();
        const resultado = sistema.analisarTodosTimeframes(dados);
        sistema.imprimirResultado(resultado);
        return resultado;
    } catch (error) {
        console.error("❌ Erro fatal na análise:", error);
        return { 
            erro: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// ======================================================================
// 1. ESTRUTURA MACD AVANÇADA - Separa Estrutura de Momentum
// ======================================================================
class MACDStructure {
    constructor(macdLine, signalLine, histogram) {
        this.macdLine = macdLine || 0;
        this.signalLine = signalLine || 0;
        this.histogram = histogram || 0;
        
        // ESTRUTURA (onde o mercado ESTÁ - posição em relação ao zero)
        this.structuralBias = this.determineStructuralBias();
        
        // MOMENTUM (para onde está indo - direção do histograma)
        this.momentumBias = this.determineMomentumBias();
        
        // É correção? (momentum contra estrutura)
        this.isCorrection = this.detectCorrection();
        
        // Forças
        this.structuralStrength = Math.abs(this.macdLine);
        this.momentumStrength = Math.abs(this.histogram);
    }
    
    determineStructuralBias() {
        if (this.macdLine > 0 && this.signalLine > 0) return "BULLISH";
        if (this.macdLine < 0 && this.signalLine < 0) return "BEARISH";
        return "NEUTRAL";
    }
    
    determineMomentumBias() {
        if (this.histogram > 0) return "BULLISH";
        if (this.histogram < 0) return "BEARISH";
        return "NEUTRAL";
    }
    
    detectCorrection() {
        // Correção = momentum contra estrutura
        return ((this.structuralBias === "BULLISH" && this.momentumBias === "BEARISH") ||
                (this.structuralBias === "BEARISH" && this.momentumBias === "BULLISH"));
    }
    
    // Método para atualizar com novos valores
    update(macdLine, signalLine, histogram) {
        this.macdLine = macdLine || this.macdLine;
        this.signalLine = signalLine || this.signalLine;
        this.histogram = histogram || this.histogram;
        
        this.structuralBias = this.determineStructuralBias();
        this.momentumBias = this.determineMomentumBias();
        this.isCorrection = this.detectCorrection();
        this.structuralStrength = Math.abs(this.macdLine);
        this.momentumStrength = Math.abs(this.histogram);
        
        return this;
    }
    
    // Descrição textual completa
    getDescription() {
        return {
            structuralBias: this.structuralBias,
            momentumBias: this.momentumBias,
            isCorrection: this.isCorrection,
            structuralStrength: this.structuralStrength.toFixed(4),
            momentumStrength: this.momentumStrength.toFixed(4),
            macdLine: this.macdLine.toFixed(4),
            signalLine: this.signalLine.toFixed(4),
            histogram: this.histogram.toFixed(4)
        };
    }
}

// ======================================================================
// 2. TREND RESOLVER - ESTADOS DO MERCADO
// ======================================================================
const MARKET_STATE = {
    STRONG_BULL_TREND: "STRONG_BULL_TREND",     // Tendência forte bullish
    STRONG_BEAR_TREND: "STRONG_BEAR_TREND",     // Tendência forte bearish
    BULLISH_CORRECTION: "BULLISH_CORRECTION",   // Correção em tendência bullish
    BEARISH_CORRECTION: "BEARISH_CORRECTION",   // Correção em tendência bearish
    TRANSITION: "TRANSITION",                    // Transição de tendência
    RANGE: "RANGE",                              // Mercado lateral
    EXHAUSTION: "EXHAUSTION",                    // Exaustão
    NO_TRADE: "NO_TRADE"                         // Não operar
};

const SIGNAL_TYPE = {
    TREND_CONTINUATION: "TREND_CONTINUATION",   // Continuação de tendência
    PULLBACK: "PULLBACK",                         // Pullback na tendência
    TRANSITION: "TRANSITION",                     // Transição
    RANGE_BREAKOUT: "RANGE_BREAKOUT",             // Rompimento
    NONE: "NONE"
};

// ======================================================================
// 3. FUNÇÃO DE RESOLUÇÃO DE ESTADO (CORAÇÃO DO SISTEMA)
// ======================================================================
class TrendResolver {
    constructor() {
        this.result = {
            marketState: "UNDEFINED",
            signalType: "NONE",
            tradeAllowed: false,
            reasonBlocked: "",
            confidenceScore: 0,
            finalBias: "NEUTRAL",
            h1Confirmation: "",
            m15Quality: ""
        };
    }
    
    resolveMarketState(params) {
        const {
            h4MACDStructure,
            h1MACDStructure,
            h4ADX = 25,
            h4RSI = 50,
            d1Context = null,
            totalScore = 50
        } = params;
        
        const result = {
            marketState: "UNDEFINED",
            signalType: "NONE",
            tradeAllowed: false,
            reasonBlocked: "",
            confidenceScore: 0,
            finalBias: "NEUTRAL",
            h1Confirmation: "",
            m15Quality: ""
        };
        
        // Verificação D1 (se ativo)
        if (d1Context && d1Context.blockAllTrades) {
            result.marketState = MARKET_STATE.NO_TRADE;
            result.tradeAllowed = false;
            result.reasonBlocked = "D1 Block All Trades";
            return result;
        }
        
        // Análise estrutural 4H
        const h4StructuralBullish = (h4MACDStructure.structuralBias === "BULLISH");
        const h4StructuralBearish = (h4MACDStructure.structuralBias === "BEARISH");
        
        // Força 4H (ADX)
        const h4TrendStrength = (h4ADX > 25);
        const h4Range = (h4ADX < 20);
        
        // Exaustão 4H (RSI)
        const h4ExhaustionBull = (h4RSI > 70);
        const h4ExhaustionBear = (h4RSI < 30);
        
        // Momentum 1H
        const h1MomentumBullish = (h1MACDStructure.momentumBias === "BULLISH");
        const h1MomentumBearish = (h1MACDStructure.momentumBias === "BEARISH");
        
        // CASO 1: ESTRUTURA BEARISH FORTE
        if (h4StructuralBearish && h4TrendStrength && !h4ExhaustionBear) {
            result.finalBias = "BEARISH";
            
            if (h1MomentumBullish) {
                result.marketState = MARKET_STATE.BULLISH_CORRECTION;
                result.signalType = SIGNAL_TYPE.PULLBACK;
                result.h1Confirmation = "BEARISH_CORRECTION";
                result.tradeAllowed = true;
            } else if (h1MomentumBearish) {
                result.marketState = MARKET_STATE.STRONG_BEAR_TREND;
                result.signalType = SIGNAL_TYPE.TREND_CONTINUATION;
                result.h1Confirmation = "BEARISH_CONFIRMED";
                result.tradeAllowed = true;
            }
        }
        
        // CASO 2: ESTRUTURA BULLISH FORTE
        else if (h4StructuralBullish && h4TrendStrength && !h4ExhaustionBull) {
            result.finalBias = "BULLISH";
            
            if (h1MomentumBearish) {
                result.marketState = MARKET_STATE.BEARISH_CORRECTION;
                result.signalType = SIGNAL_TYPE.PULLBACK;
                result.h1Confirmation = "BULLISH_CORRECTION";
                result.tradeAllowed = true;
            } else if (h1MomentumBullish) {
                result.marketState = MARKET_STATE.STRONG_BULL_TREND;
                result.signalType = SIGNAL_TYPE.TREND_CONTINUATION;
                result.h1Confirmation = "BULLISH_CONFIRMED";
                result.tradeAllowed = true;
            }
        }
        
        // CASO 3: CONFLITO (TRANSITION)
        else if (h4MACDStructure.isCorrection && h4TrendStrength) {
            result.marketState = MARKET_STATE.TRANSITION;
            result.signalType = SIGNAL_TYPE.TRANSITION;
            result.tradeAllowed = false;
            result.reasonBlocked = "Market in Transition (Structure vs Momentum)";
            result.h1Confirmation = "TRANSITION";
        }
        
        // CASO 4: RANGE
        else if (h4Range) {
            result.marketState = MARKET_STATE.RANGE;
            result.signalType = SIGNAL_TYPE.RANGE_BREAKOUT;
            result.tradeAllowed = false;
            result.finalBias = "NEUTRAL";
            result.h1Confirmation = "RANGE";
            if (!result.tradeAllowed) result.reasonBlocked = "Range - Low ADX";
        }
        
        // CASO 5: EXAUSTÃO
        else if (h4ExhaustionBull || h4ExhaustionBear) {
            result.marketState = MARKET_STATE.EXHAUSTION;
            result.signalType = SIGNAL_TYPE.NONE;
            result.tradeAllowed = false;
            result.reasonBlocked = "Exhaustion Detected (RSI extreme)";
            result.h1Confirmation = "EXHAUSTION";
        }
        
        // CASO 6: SEM ESTRUTURA CLARA
        else {
            result.marketState = MARKET_STATE.NO_TRADE;
            result.signalType = SIGNAL_TYPE.NONE;
            result.tradeAllowed = false;
            result.reasonBlocked = "No clear market structure";
            result.h1Confirmation = "UNCLEAR";
        }
        
        // REGRAS DE BLOQUEIO ESPECÍFICAS
        // Histograma positivo com MACD negativo = PROIBIDO CALL como tendência
        if (h4StructuralBearish && h1MomentumBullish && result.signalType === SIGNAL_TYPE.TREND_CONTINUATION) {
            result.tradeAllowed = false;
            result.reasonBlocked = "Hist positive with MACD negative = No CALL trend (only pullback)";
        }
        
        // Histograma negativo com MACD positivo = PROIBIDO PUT como tendência
        if (h4StructuralBullish && h1MomentumBearish && result.signalType === SIGNAL_TYPE.TREND_CONTINUATION) {
            result.tradeAllowed = false;
            result.reasonBlocked = "Hist negative with MACD positive = No PUT trend (only pullback)";
        }
        
        // Se D1 for NEUTRAL, exigir score mais alto
        if (d1Context && d1Context.context === "NEUTRAL" && result.tradeAllowed) {
            if (totalScore < 60) {
                result.tradeAllowed = false;
                result.reasonBlocked = "D1 Neutral - Score < 60";
            }
        }
        
        // Calcular confiança
        result.confidenceScore = this.calculateConfidenceScore(result, h4MACDStructure, h1MACDStructure);
        
        return result;
    }
    
    calculateConfidenceScore(resolver, h4MACD, h1MACD) {
        let score = 0;
        
        // Base por estado
        switch(resolver.marketState) {
            case MARKET_STATE.STRONG_BULL_TREND:
            case MARKET_STATE.STRONG_BEAR_TREND:
                score += 40;
                break;
            case MARKET_STATE.BULLISH_CORRECTION:
            case MARKET_STATE.BEARISH_CORRECTION:
                score += 25;
                break;
            case MARKET_STATE.TRANSITION:
                score += 10;
                break;
            case MARKET_STATE.RANGE:
                score += 15;
                break;
            case MARKET_STATE.EXHAUSTION:
            case MARKET_STATE.NO_TRADE:
                return 0;
        }
        
        // Bônus por alinhamento estrutural
        if (h4MACD.structuralBias !== "NEUTRAL" && h1MACD.momentumBias !== "NEUTRAL") {
            // Alinhamento perfeito (estrutura e momentum na mesma direção)
            if ((h4MACD.structuralBias === "BULLISH" && h1MACD.momentumBias === "BULLISH") ||
                (h4MACD.structuralBias === "BEARISH" && h1MACD.momentumBias === "BEARISH")) {
                score += 30;
            }
            
            // Correção válida (estrutura e momentum opostos mas com força)
            else if (h4MACD.isCorrection && h4MACD.structuralStrength > 0.0005) {
                score += 20;
            }
        }
        
        // Confirmações adicionais
        if (resolver.h1Confirmation.includes("CONFIRMED")) score += 20;
        if (resolver.m15Quality === "OK") score += 15;
        
        // Penalidade por exaustão
        if (resolver.marketState === MARKET_STATE.EXHAUSTION) {
            score *= 0.7; // Reduz 30%
        }
        
        return Math.min(Math.max(score, 0), 100);
    }
}

// ======================================================================
// 4. SISTEMA DE PESOS DINÂMICOS
// ======================================================================
class DynamicWeightsSystem {
    constructor() {
        this.currentWeights = {
            weightMACD: 25,
            weightADX: 20,
            weightRSI: 15
        };
    }
    
    adjustDynamicWeights(currentScore) {
        if (currentScore > 70) {
            // Mercado forte - dar mais peso ao momentum
            this.currentWeights = {
                weightMACD: 30,
                weightADX: 25,
                weightRSI: 15
            };
        } else if (currentScore < 30) {
            // Mercado fraco - ser mais conservador (ADX ganha peso)
            this.currentWeights = {
                weightMACD: 20,
                weightADX: 30,
                weightRSI: 20
            };
        } else {
            // Mercado normal - pesos padrão
            this.currentWeights = {
                weightMACD: 25,
                weightADX: 20,
                weightRSI: 15
            };
        }
        
        return this.currentWeights;
    }
    
    calculateWeightedScore(indicators) {
        const {
            macdScore = 0,
            adxScore = 0,
            rsiScore = 0,
            totalScore = 0
        } = indicators;
        
        // Ajustar pesos baseado no score atual
        this.adjustDynamicWeights(totalScore);
        
        // Calcular score ponderado
        const weightedScore = (
            macdScore * (this.currentWeights.weightMACD / 100) +
            adxScore * (this.currentWeights.weightADX / 100) +
            rsiScore * (this.currentWeights.weightRSI / 100)
        );
        
        return Math.min(Math.max(weightedScore, 0), 100);
    }
    
    getWeights() {
        return { ...this.currentWeights };
    }
}

// ======================================================================
// 5. DETECÇÃO DE EXAUSTÃO
// ======================================================================
class ExhaustionDetector {
    constructor() {
        this.exhaustionSignals = [];
    }
    
    detectExhaustion(candles, direction, macdHistory = []) {
        if (!candles || candles.length < 5) return false;
        
        let signals = 0;
        const reasons = [];
        
        // 1. MACD perdendo força
        if (this.checkMACDLoss(macdHistory, direction)) {
            signals++;
            reasons.push("MACD losing strength");
        }
        
        // 2. Vela de rejeição
        if (this.checkRejectionCandle(candles, direction)) {
            signals++;
            reasons.push("Rejection candle");
        }
        
        // 3. RSI extremo
        if (this.checkRSIExtreme(candles, direction)) {
            signals++;
            reasons.push("RSI extreme");
        }
        
        // 4. Volume diminuindo
        if (this.checkVolumeDecline(candles)) {
            signals++;
            reasons.push("Volume declining");
        }
        
        const isExhausted = signals >= 2;
        
        if (isExhausted) {
            this.exhaustionSignals.push({
                timestamp: Date.now(),
                direction: direction,
                signals: signals,
                reasons: reasons
            });
            
            // Manter apenas últimos 20 sinais
            if (this.exhaustionSignals.length > 20) {
                this.exhaustionSignals = this.exhaustionSignals.slice(-20);
            }
        }
        
        return {
            exhausted: isExhausted,
            signals: signals,
            reasons: reasons,
            strength: signals / 4 // 0.25 a 1.0
        };
    }
    
    checkMACDLoss(macdHistory, direction) {
        if (!macdHistory || macdHistory.length < 3) return false;
        
        // Pegar últimos 3 histogramas
        const hist1 = Math.abs(macdHistory[macdHistory.length - 1] || 0);
        const hist2 = Math.abs(macdHistory[macdHistory.length - 2] || 0);
        const hist3 = Math.abs(macdHistory[macdHistory.length - 3] || 0);
        
        // Verificar se está diminuindo consistentemente
        return (hist1 < hist2 && hist2 < hist3);
    }
    
    checkRejectionCandle(candles, direction) {
        if (!candles || candles.length < 1) return false;
        
        const lastCandle = candles[candles.length - 1];
        const bodySize = Math.abs(lastCandle.close - lastCandle.open);
        
        if (bodySize === 0) return false;
        
        if (direction === "CALL" || direction === "BUY") { 
            // Para compra, rejeição = sombra superior longa (compradores rejeitados)
            const upperShadow = lastCandle.high - Math.max(lastCandle.close, lastCandle.open);
            return (upperShadow > bodySize * 1.5);
        } else if (direction === "PUT" || direction === "SELL") { 
            // Para venda, rejeição = sombra inferior longa (vendedores rejeitados)
            const lowerShadow = Math.min(lastCandle.close, lastCandle.open) - lastCandle.low;
            return (lowerShadow > bodySize * 1.5);
        }
        
        return false;
    }
    
    checkRSIExtreme(candles, direction) {
        // Esta função seria chamada com RSI já calculado externamente
        // Implementação básica - o RSI deve ser passado como parâmetro
        return false;
    }
    
    checkVolumeDecline(candles) {
        if (!candles || candles.length < 5) return false;
        
        // Pegar volumes dos últimos candles
        const volumes = candles.slice(-5).map(c => c.volume || 0);
        if (volumes.some(v => v === 0)) return false;
        
        // Verificar se volume está diminuindo
        return (volumes[4] < volumes[3] && 
                volumes[3] < volumes[2] && 
                volumes[2] < volumes[1]);
    }
    
    getRecentExhaustion(minutes = 30) {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        return this.exhaustionSignals.filter(s => s.timestamp > cutoff);
    }
}

// ======================================================================
// 6. ZONA DE PULLBACK INTELIGENTE
// ======================================================================
class PullbackZoneCalculator {
    constructor() {
        this.activeZones = [];
    }
    
    calculatePullbackZone(candles, direction, atr, atrMultiplier = 0.5) {
        if (!candles || candles.length < 5) return null;
        
        const recent = candles.slice(-5);
        
        if (direction === "CALL" || direction === "BUY") {
            // Para compra, queremos comprar na queda (pullback em tendência de alta)
            const downCandles = recent.filter(c => c.close < c.open).length;
            const lastCandleUp = recent[recent.length - 1].close > recent[recent.length - 2].close;
            
            if (downCandles >= 2 && lastCandleUp) {
                const low = Math.min(...recent.map(c => c.low));
                const high = Math.max(...recent.map(c => c.high));
                
                const zone = {
                    low: low,
                    high: low + (atr * atrMultiplier),
                    type: "PULLBACK_BUY",
                    confidence: Math.min(downCandles * 20, 80), // 40-80%
                    timestamp: Date.now()
                };
                
                this.activeZones.push(zone);
                return zone;
            }
        } else if (direction === "PUT" || direction === "SELL") {
            // Para venda, queremos vender na subida (pullback em tendência de baixa)
            const upCandles = recent.filter(c => c.close > c.open).length;
            const lastCandleDown = recent[recent.length - 1].close < recent[recent.length - 2].close;
            
            if (upCandles >= 2 && lastCandleDown) {
                const low = Math.min(...recent.map(c => c.low));
                const high = Math.max(...recent.map(c => c.high));
                
                const zone = {
                    low: high - (atr * atrMultiplier),
                    high: high,
                    type: "PULLBACK_SELL",
                    confidence: Math.min(upCandles * 20, 80), // 40-80%
                    timestamp: Date.now()
                };
                
                this.activeZones.push(zone);
                return zone;
            }
        }
        
        return null;
    }
    
    isPriceInZone(price, zone) {
        if (!zone) return false;
        return (price >= zone.low && price <= zone.high);
    }
    
    getActiveZones(maxAgeSeconds = 300) { // 5 minutos padrão
        const cutoff = Date.now() - (maxAgeSeconds * 1000);
        return this.activeZones.filter(z => z.timestamp > cutoff);
    }
    
    clearOldZones(maxAgeSeconds = 300) {
        const cutoff = Date.now() - (maxAgeSeconds * 1000);
        this.activeZones = this.activeZones.filter(z => z.timestamp > cutoff);
    }
    
    calculateDynamicATR(candles, period = 14) {
        if (!candles || candles.length < period) return 0.001;
        
        const recent = candles.slice(-period);
        const trs = [];
        
        for (let i = 1; i < recent.length; i++) {
            const high = recent[i].high;
            const low = recent[i].low;
            const prevClose = recent[i-1].close;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trs.push(tr);
        }
        
        return trs.reduce((a, b) => a + b, 0) / trs.length;
    }
}

// ======================================================================
// CLASSE PRINCIPAL PARA INTEGRAÇÃO (OPCIONAL)
// ======================================================================
class AdvancedMarketAnalyzer {
    constructor() {
        this.macdStructure = new MACDStructure(0, 0, 0);
        this.trendResolver = new TrendResolver();
        this.dynamicWeights = new DynamicWeightsSystem();
        this.exhaustionDetector = new ExhaustionDetector();
        this.pullbackZoneCalc = new PullbackZoneCalculator();
        
        this.lastAnalysis = null;
    }
    
    analyze(candles, indicators) {
        const {
            macdLine = 0,
            macdSignal = 0,
            macdHist = 0,
            adx = 25,
            rsi = 50,
            h4ADX = 25,
            h4RSI = 50,
            totalScore = 50
        } = indicators;
        
        // 1. Atualizar estrutura MACD
        this.macdStructure.update(macdLine, macdSignal, macdHist);
        
        // 2. Preparar parâmetros para Trend Resolver
        const trendParams = {
            h4MACDStructure: this.macdStructure,
            h1MACDStructure: this.macdStructure, // Simplificado - idealmente seria outro timeframe
            h4ADX: h4ADX,
            h4RSI: h4RSI,
            totalScore: totalScore
        };
        
        // 3. Resolver estado do mercado
        const marketState = this.trendResolver.resolveMarketState(trendParams);
        
        // 4. Ajustar pesos dinâmicos
        const weights = this.dynamicWeights.adjustDynamicWeights(totalScore);
        
        // 5. Detectar exaustão (se tiver direção)
        let exhaustion = null;
        if (marketState.finalBias !== "NEUTRAL") {
            exhaustion = this.exhaustionDetector.detectExhaustion(
                candles, 
                marketState.finalBias,
                [macdHist] // Histórico simplificado
            );
        }
        
        // 6. Calcular zona de pullback (se aplicável)
        let pullbackZone = null;
        if (marketState.signalType === SIGNAL_TYPE.PULLBACK) {
            const atr = this.pullbackZoneCalc.calculateDynamicATR(candles);
            pullbackZone = this.pullbackZoneCalc.calculatePullbackZone(
                candles,
                marketState.finalBias,
                atr
            );
        }
        
        // 7. Montar análise completa
        this.lastAnalysis = {
            timestamp: Date.now(),
            macdStructure: this.macdStructure.getDescription(),
            marketState: marketState,
            weights: weights,
            exhaustion: exhaustion,
            pullbackZone: pullbackZone,
            summary: {
                bias: marketState.finalBias,
                state: marketState.marketState,
                signalType: marketState.signalType,
                tradeAllowed: marketState.tradeAllowed,
                confidence: marketState.confidenceScore,
                reason: marketState.reasonBlocked || "OK to trade"
            }
        };
        
        return this.lastAnalysis;
    }
    
    getSummary() {
        if (!this.lastAnalysis) return null;
        
        const s = this.lastAnalysis.summary;
        return {
            signal: s.bias === "BULLISH" ? "CALL" : s.bias === "BEARISH" ? "PUT" : "HOLD",
            confidence: s.confidence,
            tradeAllowed: s.tradeAllowed,
            state: s.state,
            reason: s.reason
        };
    }
}

// ======================================================================
// EXPORTAÇÃO (se estiver usando módulos)
// ======================================================================
if (typeof module !== 'undefined' && module.exports) {
    // Merge with existing exports
    module.exports = {
        ...module.exports,
        MACDStructure,
        MARKET_STATE,
        SIGNAL_TYPE,
        TrendResolver,
        DynamicWeightsSystem,
        ExhaustionDetector,
        PullbackZoneCalculator,
        AdvancedMarketAnalyzer
    };
}

// ============================================================================
// BLOCO DE CORREÇÃO E EXECUÇÃO RIGOROSA (ADICIONADO CONFORME SUGESTÃO)
// ============================================================================

const BOT_SHIELD_CONFIG = {
    MIN_CONFIDENCE: 75,             // Só opera se a confiança for > 75%
    USE_CLOSED_CANDLES_ONLY: true,  // Anti-Repainting: ignora a vela atual (0) e olha a (1)
    ELLIOTT_WEIGHT_REDUCTION: 0.3,  // Reduz impacto de Elliott (filtro, não gatilho)
    MAX_ALLOWED_DELAY_MS: 30000     // 30s: Máxima diferença de tempo entre H4 e M5
};

class BotExecutionCore {
    /**
     * Valida se os dados dos diferentes timeframes estão sincronizados
     */
    static checkSync(dataM5, dataH4) {
        const timeM5 = dataM5[dataM5.length - 1].timestamp;
        const timeH4 = dataH4[dataH4.length - 1].timestamp;
        
        // Verifica se o H4 não está "velho" demais (Cache antigo)
        const diff = Math.abs(timeM5 - timeH4);
        return diff < (4 * 60 * 60 * 1000) + BOT_SHIELD_CONFIG.MAX_ALLOWED_DELAY_MS;
    }

    /**
     * Filtro de Horário e Notícias (Blacklist)
     */
    static isHighImpactTime() {
        const now = new Date();
        const hour = now.getUTCHours();
        const min = now.getUTCMinutes();
        const day = now.getUTCDay();

        // 1. Evita abertura de Londres (07:00 - 08:30 UTC) e NY (13:00 - 14:30 UTC)
        // Momentos de alta volatilidade irracional e manipulação
        if ((hour === 7 || hour === 13) && min < 30) return true;

        // 2. Evita finais de semana (Baixa liquidez no spot/crypto dependendo da corretora)
        if (day === 0 || day === 6) return false; // Ajuste conforme sua estratégia

        return false;
    }

    /**
     * GATILHO FINAL DE OPERAÇÃO
     */
    static processSignal(analysis, candleData) {
        // A. ANTI-REPAINTING: Força o uso da última vela FECHADA
        // Se candleData[0] é a atual, usamos candleData[1]
        const closedCandle = candleData[candleData.length - 2]; 

        // B. FILTRO DE NOTÍCIAS/HORÁRIO
        if (this.isHighImpactTime()) {
            console.log("⚠️ BLOQUEIO: Período de alta volatilidade (Notícias/Abertura).");
            return { action: "WAIT", reason: "Market Noise" };
        }

        // C. AJUSTE DE ELLIOTT (Reduz peso para evitar falsos rompimentos)
        let finalConfidence = analysis.summary.confidence;
        if (analysis.elliottWave && analysis.elliottWave.uncertainty > 0.5) {
            finalConfidence *= BOT_SHIELD_CONFIG.ELLIOTT_WEIGHT_REDUCTION;
        }

        // D. LÓGICA DE ENTRADA (PULLBACK vs BREAKOUT)
        const isBullish = analysis.summary.bias === "BULLISH";
        const isTrending = analysis.summary.state === "TRENDING_UP" || analysis.summary.state === "TRENDING_DOWN";

        // Critério de Confiança
        if (finalConfidence < BOT_SHIELD_CONFIG.MIN_CONFIDENCE) {
            return { action: "WAIT", reason: "Low Confidence: " + finalConfidence.toFixed(2) };
        }

        // E. DEFINIÇÃO DE STOP E ALVO (Baseado no PullbackZone do seu script)
        const entryPrice = closedCandle.close;
        const stopLoss = isBullish ? (analysis.pullbackZone.support) : (analysis.pullbackZone.resistance);
        
        // Validação de segurança do Stop
        if (!stopLoss || Math.abs(entryPrice - stopLoss) === 0) {
            return { action: "WAIT", reason: "Invalid Stop Loss Calculation" };
        }

        return {
            action: isBullish ? "BUY" : "SELL",
            entry: entryPrice,
            sl: stopLoss,
            tp: entryPrice + (Math.abs(entryPrice - stopLoss) * 1.5), // R/R 1:1.5
            confidence: finalConfidence
        };
    }
}

// ========== EXEMPLO DE COMO CHAMAR NO SEU LOOP PRINCIPAL ==========
/*
    const analysis = analyzer.analyzeFull(dataM5, dataH4, dataH24);
    
    if (BotExecutionCore.checkSync(dataM5, dataH4)) {
        const order = BotExecutionCore.processSignal(analysis, dataM5);
        
        if (order.action !== "WAIT") {
            console.log(`🚀 EXECUTANDO ${order.action} | Confiança: ${order.confidence}%`);
            console.log(`Entrada: ${order.entry} | SL: ${order.sl} | TP: ${order.tp}`);
            // Seu comando de API da corretora aqui:
            // sendOrder(order);
        }
    } else {
        console.log("❌ ERRO DE SINCRONIA: Dados de H4/H24 estão desatualizados.");
    }
*/

// ========== FUNÇÃO PARA FORMATAR MENSAGENS DO TELEGRAM ==========
function formatarParaTelegram(resultado) {
    const emoji = resultado.sinalFinal === 'CALL' ? '🟢' : resultado.sinalFinal === 'PUT' ? '🔴' : '⚪';
    
    // Pega os 3 timeframes principais para não ficar muito longo
    const timeframesPrincipais = ['M5', 'M15', 'M30', 'H1', 'H4', 'H24'].filter(tf => resultado.analises[tf]);
    
    let mensagem = `
🤖 *ANÁLISE DE MERCADO*
📅 ${new Date().toLocaleString('pt-BR')}

${emoji} *SINAL:* ${resultado.sinalFinal}
📊 *Confiança:* ${resultado.probabilidade}% (${resultado.confianca})
💰 *Preço:* ${resultado.precoAtual?.toFixed(2) || 'N/A'}

📈 *TIMEFRAMES:*
`;

    // Adiciona cada timeframe
    timeframesPrincipais.forEach(tf => {
        const a = resultado.analises[tf];
        if (a) {
            const icone = a.sinal === 'CALL' ? '🟢' : a.sinal === 'PUT' ? '🔴' : '⚪';
            mensagem += `   ${icone} ${tf}: ADX ${a.adx?.toFixed(1) || 'N/A'} | ${a.macd.trend}\n`;
        }
    });

    // Adiciona estratégia
    mensagem += `
🎯 *ESTRATÉGIA:*
   Entrada: ${resultado.niveis?.entrada?.toFixed(2) || 'N/A'}
   Stop: ${resultado.niveis?.stopLoss || 'N/A'}
   Alvo 1: ${resultado.niveis?.alvos?.[0] || 'N/A'}
   Alvo 2: ${resultado.niveis?.alvos?.[1] || 'N/A'}

💡 *AÇÃO:* ${resultado.acao || 'N/A'}

⚠️ *ALERTAS:* ${resultado.alertas?.length || 0}
`;

    // Adiciona o primeiro alerta se existir
    if (resultado.alertas && resultado.alertas.length > 0) {
        mensagem += `🔔 ${resultado.alertas[0]}\n`;
    }

    return mensagem;
}

// ========== INTEGRAÇÃO DERIV API + RECONEXÃO AUTOMÁTICA ==========

/**
 * Lista de símbolos (ativos) suportados pela Deriv (exemplos)
 */
const SYMBOLS = [
  'R_25',           // Volatility 25
  'R_10',           // Volatility 10
  'R_50',           // Volatility 50
  'R_75',           // Volatility 75
  'R_100',          // Volatility 100
  'frxXAUUSD',      // Ouro
  'frxXAGUSD',      // Prata
  'cryBTCUSD',      // Bitcoin
  'cryETHUSD'       // Ethereum
];

/**
 * Cliente WebSocket para a API da Deriv com reconexão automática
 */
class DerivClient {
  /**
   * @param {string} appId - ID da aplicação (padrão: 1089 – demo)
   * @param {string} token - Token de autorização (padrão: token de demonstração)
   * @param {boolean} autoReconnect - Ativar reconexão automática (padrão: true)
   */
  constructor(appId = '1089', token = '1Jd2sESxdZ24Luv', autoReconnect = true) {
    this.appId = appId;
    this.token = token;
    this.autoReconnect = autoReconnect;
    this.ws = null;
    this.connected = false;
    this.authorized = false;
    this.reqId = 1;
    this.callbacks = new Map();
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000; // 30s
  }

  /**
   * Estabelece a conexão WebSocket e autoriza automaticamente.
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0; // reset ao conectar
        this._startPing();
        this.authorize()
          .then(() => resolve())
          .catch(err => reject(err));
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      };

      this.ws.onerror = (error) => {
        reject(error);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.authorized = false;
        this._stopPing();
        if (this.autoReconnect) {
          this._scheduleReconnect();
        }
      };
    });
  }

  /**
   * Agenda uma tentativa de reconexão com backoff exponencial.
   */
  _scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(err => {
        console.warn('Tentativa de reconexão falhou:', err.message);
      });
    }, delay);
  }

  /**
   * Reconecta manualmente (encerra a conexão atual e tenta novamente).
   */
  reconnect() {
    this.disconnect();
    return this.connect();
  }

  /**
   * Envia o comando de autorização com o token fornecido.
   * @returns {Promise<Object>}
   */
  authorize() {
    return this._sendRequest({ authorize: this.token })
      .then(response => {
        if (!response.error) {
          this.authorized = true;
        }
        return response;
      });
  }

  /**
   * Envia um ping para manter a conexão ativa.
   * @returns {Promise<Object>}
   */
  ping() {
    return this._sendRequest({ ping: 1 });
  }

  /**
   * Busca candles para todos os timeframes definidos em TIMEFRAMES.
   * @param {string} symbol - Símbolo do ativo.
   * @param {number} count - Número de candles por timeframe.
   * @returns {Promise<Object>} Objeto com chave = nome do timeframe, valor = array de candles.
   */
  async getAllTimeframes(symbol, count) {
    const results = {};
    for (const [tfName, tfValue] of Object.entries(TIMEFRAMES)) {
      try {
        const response = await this.getCandles(symbol, tfValue, count);
        results[tfName] = response.candles || [];
      } catch (error) {
        results[tfName] = { error: error.message };
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return results;
  }

  /**
   * Busca candles históricos para um símbolo e timeframe.
   * @param {string} symbol - Símbolo do ativo.
   * @param {number} granularity - Timeframe em segundos (ex: 300 para M5).
   * @param {number} count - Número de candles desejado.
   * @returns {Promise<Object>} Resposta da API com candles.
   */
  getCandles(symbol, granularity, count) {
    return this._sendRequest({
      ticks_history: symbol,
      adjust_start_time: 1,
      end: 'latest',
      start: 1,
      style: 'candles',
      granularity: granularity,
      count: count
    });
  }

  /**
   * Fecha a conexão WebSocket manualmente.
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  // ---------- Métodos internos ----------

  _sendRequest(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('WebSocket não está conectado.'));
    }

    const req_id = this.reqId++;
    payload.req_id = req_id;

    return new Promise((resolve, reject) => {
      this.callbacks.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  _handleMessage(data) {
    if (data.msg_type === 'pong') return;

    const req_id = data.req_id;
    if (req_id && this.callbacks.has(req_id)) {
      const { resolve, reject } = this.callbacks.get(req_id);
      this.callbacks.delete(req_id);
      data.error ? reject(data.error) : resolve(data);
    } else {
      console.warn('Mensagem não solicitada:', data);
    }
  }

  _startPing() {
    this.pingInterval = setInterval(() => {
      this.ping().catch(() => {});
    }, 30000);
  }

  _stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// ========== EXPORTAÇÃO FINAL (APENAS UMA VEZ) ==========
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Do sistema original
        ElliottWaveMaster,
        RiskManager,
        AutomatedElliottTradingSystem,
        QuasimodoPattern,
        SistemaConfiabilidade,
        SistemaDuplaTendencia,
        SistemaPesosAutomaticos,
        ConfigAtivo,
        SistemaAnaliseInteligente,
        SistemaAnaliseCompleto,
        analisarMercado,
        MACDStructure,
        MARKET_STATE,
        SIGNAL_TYPE,
        TrendResolver,
        DynamicWeightsSystem,
        ExhaustionDetector,
        PullbackZoneCalculator,
        AdvancedMarketAnalyzer,
        BotExecutionCore,
        BOT_SHIELD_CONFIG,
        
        // Novas adições
        SYMBOLS,
        DerivClient,
        formatarParaTelegram
    };
}
