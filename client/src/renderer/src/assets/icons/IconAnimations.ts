const timerAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.2, 1],
    rotate: [0, 180, 0],
    transition: { duration: 1, repeat: 1 }
  }
}

const notificationAnimation = {
  initial: { y: 0 },
  animate: {
    y: [0, -5, 0],
    rotate: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.6, repeat: 1 }
  }
}

const musicAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.1, 1],
    rotate: [0, -15, 15, -15, 15, 0],
    transition: { duration: 1, repeat: 1 }
  }
}

const cameraAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.2, 1],
    rotate: [0, 360],
    transition: { duration: 1, repeat: 1 }
  }
}

const todoAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.1, 1],
    rotate: [0, 10, -10, 10, -10, 0],
    transition: { duration: 0.8, repeat: 1 }
  }
}

export { timerAnimation, notificationAnimation, musicAnimation, cameraAnimation, todoAnimation }
