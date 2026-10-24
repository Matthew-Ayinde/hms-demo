'use client'

import { useEffect, useRef, useState } from 'react'

/** Canvas signature capture. Emits a PNG data URL, or '' when cleared. */
export function SignaturePad({ onChange, height = 140 }: { onChange: (dataUrl: string) => void; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1b1a17'
  }, [height])

  const point = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    drawing.current = true
    canvasRef.current!.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current!.getContext('2d')!
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    hasInk.current = true
    if (empty) setEmpty(false)
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    if (hasInk.current) onChange(canvasRef.current!.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    setEmpty(true)
    onChange('')
  }

  return (
    <div>
      <div className="relative rounded-md border border-line-strong bg-sunken">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: 'none' }}
          className="block w-full cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <div className="pointer-events-none absolute right-4 bottom-7 left-4 border-b border-dashed border-line-strong" />
        {empty && <span className="pointer-events-none absolute bottom-2 left-4 text-[11px] text-ink-3">Guest signs here</span>}
      </div>
      <div className="mt-1.5 flex justify-end">
        <button type="button" onClick={clear} className="text-xs font-medium text-ink-3 hover:text-ink">
          Clear signature
        </button>
      </div>
    </div>
  )
}
