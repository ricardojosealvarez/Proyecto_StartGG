import { useQuery } from '@tanstack/react-query';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import {
  PlayerPredictionResponse,
  PredictionConfidence,
  RatingTrend,
  requestPlayerPrediction,
} from '../lib/predictions';
import { SummaryCard } from './SummaryCard';

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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Se necesitan {prediction.requiredHistorySize} periodos y actualmente hay{' '}
        {prediction.historySize}. La predicción permanecerá desactivada hasta disponer de suficiente
        trayectoria.
      </div>
    );
  }

  return (
    <section className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center gap-3">
        <TrendIcon trend={prediction.trend} />
        <div>
          <h3 className="text-xl font-bold">Predicción Glicko-2</h3>
          <p className="text-sm text-slate-600">
            Basada en {prediction.historySize} periodos cronológicos consolidados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Rating actual" value={Math.round(prediction.currentRating)} />
        <SummaryCard
          label="Próximo periodo"
          value={Math.round(prediction.projectedRating)}
          tone="accent"
        />
        <SummaryCard label="Tendencia" value={trendLabels[prediction.trend]} tone="success" />
      </div>

      <div className="mt-4 text-sm text-slate-600">
        Confianza {confidenceLabels[prediction.confidence].toLowerCase()} · RD{' '}
        {prediction.ratingDeviation.toFixed(1)} · Variación acumulada{' '}
        {prediction.ratingDelta >= 0 ? '+' : ''}
        {prediction.ratingDelta.toFixed(1)}
      </div>

      {prediction.opponentWinProbability !== undefined && (
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-900">
          Probabilidad estimada de victoria:{' '}
          <strong>{Math.round(prediction.opponentWinProbability * 100)}%</strong>
        </div>
      )}
    </section>
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
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        {error instanceof Error ? error.message : 'No se pudo consultar la predicción.'}
      </div>
    );
  }
  if (!data) return null;

  return <PlayerPredictionContent prediction={data} />;
}
