import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReadyPlayerPrediction } from '../lib/predictions';
import { PlayerPredictionContent } from './PlayerPrediction';

describe('PlayerPredictionContent', () => {
  it('muestra la trayectoria y la probabilidad contra el rival', () => {
    const prediction: ReadyPlayerPrediction = {
      status: 'ready',
      playerId: '123',
      currentRating: 1548.4,
      projectedRating: 1572.2,
      ratingDeviation: 72.3,
      volatility: 0.06,
      ratingDelta: 48.4,
      trend: 'rising',
      confidence: 'high',
      historySize: 6,
      opponentWinProbability: 0.643,
    };

    const markup = renderToStaticMarkup(<PlayerPredictionContent prediction={prediction} />);

    expect(markup).toContain('Predicción Glicko-2');
    expect(markup).toContain('Ascendente');
    expect(markup).toContain('64%');
  });

  it('bloquea la predicción si el historial es insuficiente', () => {
    const markup = renderToStaticMarkup(
      <PlayerPredictionContent
        prediction={{
          status: 'insufficient_history',
          playerId: '123',
          historySize: 1,
          requiredHistorySize: 3,
        }}
      />
    );

    expect(markup).toContain('Se necesitan 3 periodos');
  });
});
