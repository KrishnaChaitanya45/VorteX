import { useDraw } from '../hooks/useDraw'
import { motion } from 'framer-motion'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import '../assets/main.css'
import { SliderPicker } from 'react-color'
import { GoPencil } from 'react-icons/go'
import { FaHighlighter } from 'react-icons/fa'
import { MdSaveAlt, MdClear } from 'react-icons/md'
import { RiDragMoveLine } from 'react-icons/ri'
interface Position {
  top: number
  right: number
}
const DrawingContainer: React.FC = () => {
  const [showOptions, setShowOptions] = useState(false)
  const [isDrawing, setIsDrawing] = useState(true)
  const [color, setColor] = useState('#FF6666')
  const [isHighlighting, setIsHighlighting] = useState(false)
  const strokeWidthRef = React.useRef<HTMLInputElement>(null)
  const [responseMessage, setResponseMessage] = useState({
    success: false,
    message: '',
    path: ''
  })

  const onDraw = ({
    ctx,
    prevPoint,
    currentPoint
  }: {
    ctx: CanvasRenderingContext2D
    prevPoint: Point | null
    currentPoint: Point
  }) => {
    const { x: currX, y: currY } = currentPoint
    const lineColor = isHighlighting ? '#FF0000' : color // Highlighter color is red
    const lineWidth = strokeWidthRef.current?.value ?? 3
    const startPoint = prevPoint ?? currentPoint
    ctx.beginPath()
    ctx.lineWidth = Number(lineWidth)
    ctx.strokeStyle = lineColor
    ctx.moveTo(startPoint.x, startPoint.y)
    ctx.lineTo(currX, currY)
    ctx.stroke()

    ctx.fillStyle = lineColor
    ctx.beginPath()
    ctx.arc(startPoint.x, startPoint.y, 2, 0, 2 * Math.PI)
    ctx.fill()

    // Apply glow effect for highlighter mode
    if (isHighlighting) {
      ctx.shadowBlur = 500
      ctx.shadowColor = 'rgba(255, 0, 0, 0.6)' // Red glow
    } else {
      ctx.shadowBlur = 0
    }
  }

  const handlePenClick = () => {
    if (!isDrawing) window.electron.ipcRenderer.send('start-drawing')
    else window.electron.ipcRenderer.send('stop-drawing')
    setIsDrawing((prev) => !prev)
    setShowOptions(false)
  }

  useEffect(() => {
    window.electron.ipcRenderer.send('start-drawing')
    window.electron.ipcRenderer.on('screenshot-captured', (path: string) => {
      const safePath = `local-file:///${path.replace(/\\/g, '/')}`
      setResponseMessage({
        success: true,
        message: 'Screenshot saved successfully',
        path: safePath
      })
    })
    window.electron.ipcRenderer.on('screenshot-error', (path: string) => {
      console.log(path)
      setResponseMessage({ success: false, message: 'Screenshot failed to save', path: '' })
    })
    const resizeCanvas = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth
        canvasRef.current.height = window.innerHeight
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [isDrawing])

  const { canvasRef, onMouseDown } = useDraw(onDraw)
  const handleSave = () => {
    window.electron.ipcRenderer.send('take-screenshot')
  }
  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth - 50, y: 50 }) // Initialize from right
  const containerRef = useRef<HTMLDivElement>(null)

  // ... other functions

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        setPosition({
          x: Math.min(
            window.innerWidth - containerWidth / 2,
            Math.max(0, e.clientX - containerWidth / 2)
          ),
          y: Math.max(0, e.clientY - 20)
        })
      }
    },
    [isDragging]
  )

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove])

  return (
    <main className="interactive relative overflow-hidden w-screen h-screen bg-transparent flex justify-center items-center text-white">
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: `${position.y}px`,
          right: `${window.innerWidth - position.x}px`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <div className="flex  items-start gap-4">
          {showOptions && isDrawing && (
            <section className="p-4 flex flex-col items-center justify-center gap-4 rounded-xl bg-purple-500">
              <div
                className="w-full h-8 cursor-move flex items-center justify-end"
                onMouseDown={handleMouseDown}
              >
                <RiDragMoveLine className="text-white text-2xl" />
              </div>
              {responseMessage.message != '' && (
                <div className="flex flex-col items-center justify-center gap-2">
                  <p
                    className={`${responseMessage.success ? 'text-green-600' : 'text-red-500'} font-semibold text-lg`}
                  >
                    {responseMessage.message}
                  </p>
                  <div className="flex w-full justify-between items-center">
                    {responseMessage.path != '' && (
                      <button
                        onClick={() => {
                          window.electron.ipcRenderer.send(
                            'open-file-location',
                            responseMessage.path
                          )
                        }}
                        className="text-white p-2 rounded-md bg-blue-500"
                      >
                        Find It Here
                      </button>
                    )}
                    <button
                      onClick={() => setResponseMessage({ success: false, message: '', path: '' })}
                      className="bg-red-500 text-white p-2 rounded-md"
                    >
                      Okay
                    </button>
                  </div>
                </div>
              )}
              <input
                type="range"
                min={3}
                max={30}
                defaultValue={5}
                ref={strokeWidthRef}
                className="w-full accent-yellow-400 h-2 bg-black rounded-lg appearance-none cursor-pointer"
              />
              <figure className="w-full  rounded-md">
                <SliderPicker color={color} onChange={(e) => setColor(e.hex)} />
              </figure>
              <div className="flex justify-center items-center gap-4">
                <motion.button
                  onClick={() => setIsHighlighting((prev) => !prev)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`p-4 rounded-[50%] text-white shadow-md shadow-gray-700 ${isHighlighting ? 'bg-red-600 scale-110' : 'bg-gray-600'}`}
                >
                  <FaHighlighter />
                </motion.button>
                <motion.button
                  onClick={handleClear}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-4 rounded-[50%] bg-red-500 text-white shadow-md shadow-gray-700"
                >
                  <MdClear />
                </motion.button>
                <motion.button
                  onClick={handleSave}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-4 rounded-[50%] bg-green-500 text-white shadow-md shadow-gray-700"
                >
                  <MdSaveAlt />
                </motion.button>
              </div>
              <motion.button
                className="bg-red-600 text-white p-2 rounded-xl text-lg w-full"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => window.electron.ipcRenderer.send('quit-drawing')}
              >
                Quit
              </motion.button>
            </section>
          )}

          <motion.button
            whileHover={{ scale: 1.1 }}
            onMouseEnter={() => window.electron.ipcRenderer.send('start-drawing')}
            onDoubleClick={() => setShowOptions((prev) => !prev)}
            onMouseLeave={() => !isDrawing && window.electron.ipcRenderer.send('stop-drawing')}
            whileTap={{ scale: 0.9 }}
            onClick={handlePenClick}
            className={`px-5 py-5 rounded-[50%] ${isDrawing ? 'bg-purple-500 scale-110' : 'bg-white'} text-black text-4xl`}
            style={{ pointerEvents: 'auto' }}
          >
            <GoPencil />
          </motion.button>
        </div>
      </div>
      {isDrawing && (
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          id="canvas"
          className="border border-black w-[100%] h-[100%]"
        ></canvas>
      )}
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DrawingContainer />
  </React.StrictMode>
)
