import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Dropdown from '../components/Dropdown'
import { FaCamera, FaVideo } from 'react-icons/fa'
import { IpcRendererListener } from '@electron-toolkit/preload'
import { VscDebugPause, VscDebugStart, VscDebugStop } from 'react-icons/vsc'
import { Buffer } from 'buffer'
type InnerProps = {
  selectedOption: string
  setShowOptions: (showOptions: boolean) => void
  recordedChunks: Blob[]
  setRecordedChunks: (recordedChunks: Blob[]) => void
  mediaRecorder: MediaRecorder | null
  setMediaRecorder: (mediaRecorder: MediaRecorder | null) => void
  screenShotTaken: { taken: boolean; path: string }
  isRecording: { taken: boolean; path: string }
  setScreenShotTaken: (state: { taken: boolean; path: string }) => void
  setIsRecording: (state: { taken: boolean; path: string }) => void
}

export default function InnerContainer({
  selectedOption,
  setShowOptions,
  screenShotTaken,
  recordedChunks,
  setRecordedChunks,
  mediaRecorder,
  setMediaRecorder,
  setScreenShotTaken,
  isRecording,
  setIsRecording
}: InnerProps) {
  const [selected, setSelected] = useState('Sources')
  const [cameraOrRecord, setCameraOrRecord] = useState('Camera')
  const [sources, setSources] = useState<Electron.DesktopCapturerSource[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const audioCheckboxRef = useRef<HTMLInputElement>(null)
  const handleScreenshotCaptured = useCallback(
    (imagePath: string) => {
      console.log('handleScreenshotCaptured called with path:', imagePath)
      if (imagePath) {
        const safePath = `local-file:///${imagePath.replace(/\\/g, '/')}`
        console.log('Safe path:', safePath)
        setScreenShotTaken({ taken: true, path: safePath })
        setShowOptions(true)
      } else {
        console.error('Screenshot path is undefined')
      }
    },
    [setScreenShotTaken, setShowOptions]
  )

  useEffect(() => {
    console.log('Setting up IPC listeners')
    window.electron.ipcRenderer.on(
      'sources-captured',
      (sources: Electron.DesktopCapturerSource[]) => {
        setSources(sources)
      }
    )
    window.electron.ipcRenderer.on('screenshot-captured', handleScreenshotCaptured)
    window.electron.ipcRenderer.on('video-saved', (path: string) => {
      const localFilePath = `local-file:///${path.replace(/\\/g, '/').replace(/:/g, '%3A')}`
      console.log('localFilePath', localFilePath)
      setIsRecording({ taken: false, path: localFilePath })
      setShowOptions(true)
    })
    window.electron.ipcRenderer.on('video-save-error', (error: string) => {
      console.error('Error saving video:', error)
      setIsRecording({ taken: false, path: '' })
      setShowOptions(true)
    })
  }, [handleScreenshotCaptured, setIsRecording, setShowOptions])
  const handleDoubleClick = async () => {
    if (cameraOrRecord === 'Camera') {
      console.log('Double-click detected, sending take-screenshot command')
      setShowOptions(false)
      window.electron?.ipcRenderer.send('take-screenshot')
    } else {
      console.log('Double-click detected, starting video recording')
      setShowOptions(false)
      setIsRecording({ taken: true, path: '' })
      try {
        const selectedSource = sources.find((source) => source.name === selected)
        if (!selectedSource) {
          throw new Error('No source selected')
        }
        console.log('selectedSource:', selectedSource)
        console.log('audioCheckboxRef.current?.checked:', audioCheckboxRef.current?.checked)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioCheckboxRef.current?.checked
            ? { mandatory: { chromeMediaSource: 'desktop' } }
            : false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: selectedSource.id
            }
          }
        } as MediaStreamConstraints)

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })
        setMediaRecorder(recorder)

        const chunks: Blob[] = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'video/webm' })
          const arrayBuffer = await blob.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          window.electron.ipcRenderer.send('save-video', buffer)
        }

        recorder.start(1000) // Start recording and trigger ondataavailable every 1 second
      } catch (error) {
        console.error('Error starting recording:', error)
        setIsRecording({ taken: false, path: '' })
      }
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      // setIsRecording({ taken: false, path: '' });
    }
  }

  const handlePauseResume = () => {
    setIsPaused(!isPaused)
    if (mediaRecorder) {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause()
      } else if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume()
      }
    }
  }

  const handleInteraction = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    window.electron?.setIgnoreMouseEvents(false)
  }, [])

  const handleBackgroundInteraction = useCallback(() => {
    window.electron?.setIgnoreMouseEvents(true)
  }, [])

  const fetchSources = async () => {
    window.electron?.ipcRenderer.send('get-sources')
  }

  console.log('Rendering InnerContainer, screenShotTaken:', screenShotTaken)

  return (
    <div onMouseEnter={handleInteraction} onMouseLeave={handleBackgroundInteraction}>
      <motion.div
        className="w-[100%] h-[100%] text-white gap-2 rounded-xl flex-col flex items-center justify-center"
        transition={{ duration: 0.45, bounce: 100, damping: 10 }}
      >
        {!screenShotTaken.taken ? (
          !isRecording.taken && isRecording.path == '' ? (
            <figure className="w-[100%] flex items-center px-10 justify-between">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setCameraOrRecord('Camera')}
                onDoubleClick={handleDoubleClick}
                className={`text-3xl ${cameraOrRecord === 'Camera' ? 'text-[#1e1e1e] bg-white p-2 rounded-xl' : ''}`}
              >
                <FaCamera />
              </motion.button>
              <motion.button
                onClick={() => {
                  setCameraOrRecord('Video')
                  fetchSources()
                }}
                whileHover={{ scale: 1.1 }}
                onDoubleClick={handleDoubleClick}
                whileTap={{ scale: 0.9 }}
                className={`text-3xl ${cameraOrRecord === 'Video' ? 'text-[#1e1e1e] bg-white p-2 rounded-xl' : ''}`}
              >
                <FaVideo />
              </motion.button>
            </figure>
          ) : isRecording.path == '' ? (
            <figure className="w-[100%] flex items-center px-10 justify-between">
              <button
                onClick={handlePauseResume}
                className="text-3xl text-[#1e1e1e] bg-yellow-400 p-2 rounded-xl"
              >
                {isPaused ? <VscDebugStart /> : <VscDebugPause />}
              </button>
              <button
                onClick={handleStopRecording}
                className="text-3xl text-[#1e1e1e] bg-red-400 p-2 rounded-xl"
              >
                <VscDebugStop />
              </button>
            </figure>
          ) : (
            <figure className="w-[100%] flex items-center px-10 justify-between">
              <video
                key={isRecording.path}
                src={isRecording.path}
                className="rounded-xl object-cover w-full h-auto"
                controls
                onError={(e) => {
                  console.error('Video failed to load:', e.currentTarget.error)
                  console.log('Video src:', e.currentTarget.src)
                  console.log('Video error code:', e.currentTarget.error?.code)
                  console.log('Video error message:', e.currentTarget.error?.message)
                  // Attempt to reload the video after a short delay
                  // setTimeout(() => {
                  // e.currentTarget.load();
                  // }, 1000);
                }}
              />
            </figure>
          )
        ) : (
          <figure className="w-[100%] flex items-center px-10 justify-between">
            <img
              src={screenShotTaken.path}
              alt="Screenshot"
              className="rounded-xl object-cover"
              onError={(e) => console.error('Image failed to load:', e)}
            />
          </figure>
        )}

        {cameraOrRecord === 'Video' && !screenShotTaken.taken && !isRecording.taken && (
          <div className="w-[100%] gap-2 flex flex-col items-center justify-center mt-6">
            <Dropdown
              items={sources ? sources.map((source) => source.name) : []}
              selected={selected}
              setSelected={setSelected}
            />
            <div className="w-[100%] flex items-center justify-start gap-4 px-4">
              <input
                ref={audioCheckboxRef}
                type="checkbox"
                name="recod-audio"
                id=""
                className="w-4 h-4 text-purple-500 bg-gray-100 rounded-xl border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="">Include Audio</label>
            </div>
          </div>
        )}

        {screenShotTaken.path == '' &&
        isRecording.path == '' &&
        !isRecording.taken &&
        !isRecording.taken ? (
          <p className="text-sm self-start translate-y-3 translate-x-2 text-gray-400">
            {' '}
            * <b className="text-purple-500">Double Tap</b> to continue
          </p>
        ) : (
          !isRecording.taken && (
            <div className="text-sm self-start flex items-center justify-between w-full translate-y-5 px-4 translate-x-2 text-gray-400">
              <button
                className="text-purple-500 font-bold"
                onClick={() =>
                  isRecording.path != ''
                    ? window.electron.ipcRenderer.send('open-file-location', isRecording.path)
                    : window.electron.ipcRenderer.send('open-file-location', screenShotTaken.path)
                }
              >
                find it here
              </button>
              <button
                className="text-green-500 font-bold"
                onClick={() =>
                  isRecording.path != ''
                    ? setIsRecording({ taken: false, path: '' })
                    : setScreenShotTaken({ taken: false, path: '' })
                }
              >
                Okay 👍
              </button>
            </div>
          )
        )}
      </motion.div>
    </div>
  )
}
