'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import type { MockPlayer } from '@/lib/data/mock-players'

const ATTR_LABELS: Record<keyof MockPlayer['attributes'], string> = {
  pace: 'Hız',
  shooting: 'Şut',
  passing: 'Pas',
  dribbling: 'Çalım',
  defending: 'Savunma',
  physical: 'Fizik',
}

export function PlayerRadar({ attributes }: { attributes: MockPlayer['attributes'] }) {
  const data = Object.entries(attributes).map(([key, value]) => ({
    attr: ATTR_LABELS[key as keyof MockPlayer['attributes']],
    value,
  }))

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="attr"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.35}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
