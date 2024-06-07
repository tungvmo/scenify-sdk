import { fabric } from 'fabric'
import BaseHandler from './BaseHandler'

class ZoomHandler extends BaseHandler {
  zoomIn() {
    let zoomRatio = this.canvas.getZoom()
    zoomRatio += 0.05
    const center = this.canvas.getCenter()
    this.zoomToPoint(new fabric.Point(center.left, center.top), zoomRatio)
    this.context.setZoomRatio(zoomRatio)
  }

  zoomOut() {
    let zoomRatio = this.canvas.getZoom()
    zoomRatio -= 0.05
    const center = this.canvas.getCenter()
    this.zoomToPoint(new fabric.Point(center.left, center.top), zoomRatio)
    this.context.setZoomRatio(zoomRatio)
  }

  zoomToOne() {
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    const frameWidth = this.handlers.frameHandler.getOptions().width
    const frameHeight = this.handlers.frameHandler.getOptions().height

    const center = this.canvas.getCenter()
    this.canvas.setViewportTransform([
      1,
      0,
      0,
      1,
      (canvasWidth - frameWidth) / 2,
      (canvasHeight - frameHeight) / 2
    ])
    this.zoomToPoint(new fabric.Point(center.left, center.top), 1)
    this.context.setZoomRatio(1)
  }

  zoomToFit() {
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    const frameWidth = this.handlers.frameHandler.getOptions().width
    const frameHeight = this.handlers.frameHandler.getOptions().height

    const zoomFitRatio = this.handlers.frameHandler.getFitRatio()
    const center = this.canvas.getCenter()
    this.canvas.setViewportTransform([
      1,
      0,
      0,
      1,
      (canvasWidth - frameWidth) / 2,
      (canvasHeight - frameHeight) / 2
    ])
    this.zoomToPoint(new fabric.Point(center.left, center.top), zoomFitRatio)
    this.context.setZoomRatio(zoomFitRatio)
  }

  zoomToRatio(zoomRatio) {
    const center = this.canvas.getCenter()
    this.zoomToPoint(new fabric.Point(center.left, center.top), zoomRatio)
    this.context.setZoomRatio(zoomRatio)
  }

  zoomToPoint(point, zoom) {
    const minZoom = 10
    const maxZoom = 300
    let zoomRatio = zoom
    if (zoom <= minZoom / 100) {
      zoomRatio = minZoom / 100
    } else if (zoom >= maxZoom / 100) {
      zoomRatio = maxZoom / 100
    }
    this.canvas.zoomToPoint(point, zoomRatio)
    this.context.setZoomRatio(zoomRatio)
  }
}

export default ZoomHandler
