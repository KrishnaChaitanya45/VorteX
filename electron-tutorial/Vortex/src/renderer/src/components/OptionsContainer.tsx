import classNames from 'classnames'
import {
  BellIcon,
  CameraIcon,
  FileMusicIcon,
  HourglassIcon,
  PenIcon
} from '../assets/icons/SvgFunctions'
import { motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { RiDragMoveLine } from 'react-icons/ri'
import {
  cameraAnimation,
  musicAnimation,
  notificationAnimation,
  timerAnimation,
  todoAnimation
} from '../assets/icons/IconAnimations'
type OptionsProps = {
  showOptions: boolean
  onFireIconClick: () => void
  isHovered: boolean
  selected: string
  setSelected: (selected: string) => void
  setIsHovered: (isHovered: boolean) => void
}
function OptionsContainer({
  showOptions,
  onFireIconClick,
  setIsHovered,
  selected,
  setSelected,
  isHovered
}: OptionsProps): JSX.Element {
  const selectionHandler = (id: string) => {
    if (id === 'draw') {
      setSelected(id)
      window.electron.ipcRenderer.send('toggle-draw-window')
      return
    }

    if (selected === id) {
      setSelected('')
      window.electron.ipcRenderer.send('unselected')
    } else {
      const width = 200 + 200
      setSelected(id)
      window.electron.ipcRenderer.send('selected', width)
    }
  }
  const iconVariants = {
    hidden: { scale: 0, opacity: 0, top: 0, right: 0 },
    visible: (index: number) => ({
      scale: 1,
      top: `${20 - 120 * Math.cos((index * Math.PI) / 4)}%`,
      right: `${20 + 120 * Math.sin((index * Math.PI) / 4)}%`,
      opacity: 1,
      transition: { delay: index * 0.1 }
    })
  }
  const handleInteraction = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    window.electron?.setIgnoreMouseEvents(false)
  }, [])
  const options = [
    { icon: HourglassIcon, id: 'timer', color: 'text-blue-500', animation: timerAnimation },
    { icon: FileMusicIcon, id: 'music', color: 'text-pink-500', animation: musicAnimation },
    {
      icon: BellIcon,
      id: 'notification',
      color: 'text-yellow-500',
      animation: notificationAnimation
    },
    { icon: CameraIcon, id: 'camera', color: 'text-purple-500', animation: cameraAnimation },
    { icon: PenIcon, id: 'draw', color: 'text-green-500', animation: todoAnimation }
  ]

  return (
    <motion.div
      onMouseEnter={handleInteraction}
      onMouseLeave={handleInteraction}
      onClick={handleInteraction}
      className="interactive relative w-[75px] h-[75px] bg-black rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,0,0,0.5)]"
    >
      {showOptions && (
        <button
          className="draggable-div text-white absolute top-2 right-2 text-2xl"
          onMouseEnter={handleInteraction}
          onMouseLeave={handleInteraction}
          onClick={handleInteraction}
        >
          <RiDragMoveLine />
        </button>
      )}
      <motion.div
        className="cursor-pointer text-3xl flex items-center justify-center"
        style={{
          WebkitUserSelect: 'none'
        }}
        onClick={(e) => {
          handleInteraction(e)
          console.log('Fire icon clicked')
          onFireIconClick()
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        🔥
      </motion.div>
      {showOptions &&
        options.map((option, index) => {
          return (
            <motion.div
              key={option.id}
              className={`absolute text-3xl  p-3 ${selected == option.id ? 'bg-[#333] scale-110' : 'bg-black'} rounded-full flex items-center justify-center `}
              initial="hidden"
              onClick={(e) => {
                handleInteraction(e)
                selectionHandler(option.id)
              }}
              animate="visible"
              custom={index}
              variants={iconVariants}
              style={{
                pointerEvents: 'auto' // Ensure each option is clickable
              }}
            >
              <motion.button
                whileHover={option.animation.animate}
                whileTap={{
                  scale: 0.9
                }}
                initial={option.animation.initial}
              >
                <option.icon className={`w-8 h-8 ${option.color}`} />
              </motion.button>
            </motion.div>
          )
        })}
    </motion.div>
  )
}

export default OptionsContainer
