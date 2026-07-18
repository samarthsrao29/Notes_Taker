import React, { useEffect, useState } from 'react'

interface StatsSummary {
  highlightsCaptured: number
  notesCreated: number
  flashcardsGenerated: number
  aiFeaturesUsed: number
  dailyHistory: { date: string; captures: number }[]
}

export default function Dashboard(): React.JSX.Element {
  const [stats, setStats] = useState<StatsSummary | null>(null)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [days])

  const fetchStats = async (): Promise<void> => {
    try {
      setLoading(true)
      const data = await window.api.getStatsSummary(days)
      setStats(data)
    } catch (err) {
      console.error('Failed to fetch statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading performance analytics...</span>
        </div>
      </div>
    )
  }

  // Calculate SVG chart coordinates
  const chartHeight = 160
  const chartWidth = 500
  const paddingLeft = 35
  const paddingRight = 15
  const paddingTop = 15
  const paddingBottom = 25

  const graphWidth = chartWidth - paddingLeft - paddingRight
  const graphHeight = chartHeight - paddingTop - paddingBottom

  const maxVal = Math.max(...stats.dailyHistory.map((d) => d.captures), 5)

  // Build SVG Points
  const points = stats.dailyHistory.map((d, index) => {
    const x = paddingLeft + (index / (stats.dailyHistory.length - 1)) * graphWidth
    const y = paddingTop + graphHeight - (d.captures / maxVal) * graphHeight
    return { x, y, val: d.captures, label: d.date.split('-')[2] } // Date DD format
  })

  const pathD = points.length > 0
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
    : ''

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`
    : ''

  return (
    <div className="flex-1 overflow-y-auto p-8 text-zinc-100 flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
            Statistics Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Review your reading progress and capture statistics</p>
        </div>

        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                days === d
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: 'Highlights Captured',
            value: stats.highlightsCaptured,
            icon: (
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            ),
            bg: 'from-purple-500/10 to-indigo-500/5 border-purple-500/20'
          },
          {
            title: 'Manual Notes',
            value: stats.notesCreated,
            icon: (
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            bg: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20'
          },
          {
            title: 'Flashcards',
            value: stats.flashcardsGenerated,
            icon: (
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            ),
            bg: 'from-cyan-500/10 to-blue-500/5 border-cyan-500/20'
          },
          {
            title: 'AI Tasks Run',
            value: stats.aiFeaturesUsed,
            icon: (
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            ),
            bg: 'from-amber-500/10 to-orange-500/5 border-amber-500/20'
          }
        ].map((item, idx) => (
          <div
            key={idx}
            className={`bg-gradient-to-br ${item.bg} border rounded-xl p-5 flex items-center justify-between glass-card`}
          >
            <div>
              <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{item.title}</span>
              <h3 className="text-3xl font-bold mt-1 text-white">{item.value}</h3>
            </div>
            <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/50">
              {item.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Chart Panel */}
      <div className="border border-zinc-800 rounded-xl bg-zinc-950/30 p-6 flex flex-col gap-4 glass-card">
        <h3 className="text-sm font-semibold text-zinc-300">Daily Capture Progress</h3>
        
        <div className="w-full flex justify-center">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full max-w-3xl overflow-visible text-zinc-500"
          >
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = paddingTop + ratio * graphHeight
              const val = Math.round(maxVal - ratio * maxVal)
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.06}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="text-[9px] fill-zinc-600 font-mono"
                  >
                    {val}
                  </text>
                </g>
              )
            })}

            {/* Area under curve */}
            {areaD && (
              <path
                d={areaD}
                fill="url(#grad)"
                className="opacity-20"
              />
            )}

            {/* Line Path */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="url(#line-grad)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dots & Labels */}
            {points.map((p, idx) => (
              <g key={idx} className="group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  className="fill-purple-500 stroke-zinc-950 stroke-2 hover:r-5 transition-all cursor-pointer"
                />
                
                {/* Tooltip on hover (always visible above dot) */}
                <text
                  x={p.x}
                  y={p.y - 8}
                  textAnchor="middle"
                  className="text-[9px] font-bold fill-purple-300 font-mono"
                >
                  {p.val || ''}
                </text>

                {/* X Axis Labels */}
                <text
                  x={p.x}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-500 font-mono"
                >
                  {p.label}
                </text>
              </g>
            ))}

            {/* Gradients */}
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  )
}
