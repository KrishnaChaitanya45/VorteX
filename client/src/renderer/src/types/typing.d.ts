interface Point {
  x: number
  y: number
}

interface DrawLine {
  prevPoint: Point | null
  currentPoint: Point
}
