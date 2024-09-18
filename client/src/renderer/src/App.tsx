import React, { useState, useCallback, useEffect } from 'react'
import OptionsContainer from './components/OptionsContainer'
import { motion } from 'framer-motion'
import CamaraContainer from './containers/CamaraContainer'
function App(): JSX.Element {
  const [showOptions, setShowOptions] = useState(false)
  const [selected, setSelected] = useState('')
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [isHovered, setIsHovered] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [isRecording, setIsRecording] = useState({
    taken: false,
    path: ''
  })
  const [screenShotTaken, setScreenShotTaken] = useState({
    taken: false,
    path: ''
  })

  const handleFireIconClick = () => {
    setShowOptions((prev) => !prev)
  }

  const handleInteraction = useCallback(() => {
    window.electron?.setIgnoreMouseEvents(false)
  }, [])

  const handleBackgroundInteraction = useCallback(() => {
    window.electron?.setIgnoreMouseEvents(true)
  }, [])

  useEffect(() => {
    window.electron?.setIgnoreMouseEvents(true)
  }, [])

  return (
    <main
      className="overflow-hidden p-2 relative w-screen h-[100vh] bg-transparent flex items-center justify-end"
      onMouseLeave={handleBackgroundInteraction}
    >
      {selected !== '' && showOptions && (
        <motion.section
          className="max-h-[80vh] py-8 w-[55vw] rounded-xl bg-[#1e1e1e] absolute left-0"
          initial={{ x: 1000, scale: 0 }}
          animate={{ x: 0, scale: 1 }}
          exit={{ x: 1000, scale: 0 }}
          transition={{ duration: 0.45, bounce: 100, damping: 10 }}
          style={{ pointerEvents: 'auto' }}
          onMouseEnter={handleInteraction}
          onMouseLeave={() => window.electron.ipcRenderer.send('set-ignore-mouse-events', true)}
        >
          {selected === 'camera' && (
            <CamaraContainer
              selectedOption={selected}
              setShowOptions={setShowOptions}
              recordedChunks={recordedChunks}
              setRecordedChunks={setRecordedChunks}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              screenShotTaken={screenShotTaken}
              setScreenShotTaken={setScreenShotTaken}
              mediaRecorder={mediaRecorder}
              setMediaRecorder={setMediaRecorder}
            />
          )}
        </motion.section>
      )}
      <div onMouseEnter={handleInteraction} onMouseLeave={handleBackgroundInteraction}>
        <OptionsContainer
          showOptions={showOptions}
          onFireIconClick={handleFireIconClick}
          isHovered={isHovered}
          selected={selected}
          setSelected={setSelected}
          setIsHovered={setIsHovered}
        />
      </div>
    </main>
  )
}

export default App
