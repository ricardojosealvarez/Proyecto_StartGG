import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import {
  PlayerPredictionResponse,
  PredictionConfidence,
  RatingTrend,
  requestPlayerPrediction,
} from '../lib/predictions';
import { SummaryCard } from './SummaryCard';
import { Surface } from './DesignSystem';

interface PlayerPredictionProps {
  playerId: string;
  opponentId?: string;
}

interface PlayerPredictionContentProps {
  prediction: PlayerPredictionResponse;
}

const trendLabels: Record<RatingTrend, string> = {
  declining: 'Descendente',
  stable: 'Estable',
  rising: 'Ascendente',
};

const confidenceLabels: Record<PredictionConfidence, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function TrendIcon({ trend }: { trend: RatingTrend }) {
  if (trend === 'rising') return <TrendingUp className="h-6 w-6 text-emerald-600" />;
  if (trend === 'declining') return <TrendingDown className="h-6 w-6 text-red-600" />;
  return <Activity className="h-6 w-6 text-blue-600" />;
}

export function PlayerPredictionContent({ prediction }: PlayerPredictionContentProps) {
  if (prediction.status === 'insufficient_history') {
    return (
      <div className="app-alert app-alert--warning">
        Se necesitan {prediction.requiredHistorySize} periodos y actualmente hay{' '}
        {prediction.historySize}. La predicción permanecerá desactivada hasta disponer de suficiente
        trayectoria.
      </div>
    );
  }

  return (
    <Surface className="ui-prediction">
      <div className="mb-4 flex items-center gap-3">
        <TrendIcon trend={prediction.trend} />
        <div>
          <h3 className="text-base font-semibold">Predicción Glicko-2</h3>
          <p className="ui-muted">
            Basada en {prediction.historySize} periodos cronológicos consolidados.
          </p>
        </div>
      </div>

      <div className="ui-prediction__metrics">
        <SummaryCard label="Rating actual" value={Math.round(prediction.currentRating)} />
        <SummaryCard
          label="Próximo periodo"
          value={Math.round(prediction.projectedRating)}
          tone="accent"
        />
        <SummaryCard
          label="Tendencia"
          value={trendLabels[prediction.trend]}
          tone={prediction.trend === 'rising' ? 'success' : 'neutral'}
        />
      </div>

      <div className="mt-3 ui-muted">
        Confianza {confidenceLabels[prediction.confidence].toLowerCase()} · RD{' '}
        {prediction.ratingDeviation.toFixed(1)} · Variación acumulada{' '}
        {prediction.ratingDelta >= 0 ? '+' : ''}
        {prediction.ratingDelta.toFixed(1)}
      </div>

      {prediction.opponentWinProbability !== undefined && (
        <div className="ui-prediction__probability">
          Probabilidad estimada de victoria:{' '}
          <strong>{Math.round(prediction.opponentWinProbability * 100)}%</strong>
        </div>
      )}
    </Surface>
  );
}

export function PlayerPrediction({ playerId, opponentId }: PlayerPredictionProps) {
  const { data, error, isLoading } = useQuery<PlayerPredictionResponse>({
    queryKey: ['playerPrediction', playerId, opponentId],
    queryFn: () => requestPlayerPrediction(playerId, opponentId),
  });

  if (isLoading) return <div>Calculando predicción...</div>;
  if (error) {
    return (
      <div className="app-alert app-alert--warning">
        {error instanceof Error ? error.message : 'No se pudo consultar la predicción.'}
      </div>
    );
  }
  if (!data) return null;

  return <PlayerPredictionContent prediction={data} />;
}
