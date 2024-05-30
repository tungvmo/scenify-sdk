import { fabric } from 'fabric'
import { copyStyleProps, getCopyStyleCursor, ObjectType } from '../common/constants'
import { GradientOptions, ShadowOptions } from '../common/interfaces'
import objectToFabric from '../utils/objectToFabric'
import { angleToPoint, sortByLeft, sortByTop } from '../utils/parser'
import BaseHandler from './BaseHandler'
import pick from 'lodash/pick'
import { uuid } from '../utils/uuid'
class ObjectHandler extends BaseHandler {
  private clipboard
  public isCut
  private copyStyleClipboard
  public add = async item => {
    const { canvas } = this
    const options = this.handlers.frameHandler.getOptions()
    const object: fabric.Object = await objectToFabric.run(
      item,
      options,
      item.type === ObjectType.STATIC_VECTOR
    )
    if (this.config.clipToFrame) {
      const frame = this.handlers.frameHandler.getFrame()
      object.clipPath = frame
    }

    if (!item.id) {
      object.id = uuid()
    }

    if (item.type) {
      object.type = item.type
    }

    if (item.id === 'Template') {
      object.hasControls = false
      object.lockMovementY = true
      object.lockMovementX = true
      object.locked = true
      object.hoverCursor = 'Default'
      object.selectable = false
      object.evented = false
    }

    canvas.add(object)

    if (!(item.top && item.left)) {
      object.center()
    } else {
      object.top = item.top
      object.left = item.left
    }

    if (item?.id !== 'Template') {
      canvas.setActiveObject(object)
      this.context.setActiveObject(object)
    }
    this.handlers.historyHandler.save('object:created')
  }

  public update = async (options, objectId = '') => {
    const activeObject: any = this.canvas.getActiveObject()
    const canvas = this.canvas

    const fillColorObject = (object, property) => {
      ;(object?._objects || []).forEach(object => {
        if (property?.metadata?.fill || property.fill) {
          object.fill = property?.metadata?.fill || property.fill
        }
        if (property?.metadata?.stroke || property.stroke) {
          object.stroke = property?.metadata?.stroke || property.stroke
        }
        if (object._objects) {
          fillColorObject(object, property)
        }
      })
    }

    if (activeObject) {
      for (const property in options) {
        if (property === 'angle' || property === 'top' || property === 'left') {
          if (property === 'angle') {
            activeObject.rotate(options['angle'])
            canvas.requestRenderAll()
          } else {
            activeObject.set(property, options[property])
            canvas.requestRenderAll()
          }
        } else {
          // @ts-ignore
          if (activeObject._objects && activeObject.type !== ObjectType.STATIC_VECTOR) {
            // @ts-ignore
            activeObject._objects.forEach(object => {
              if (objectId && object.id !== objectId) return
              if (property === 'metadata') {
                object.set('metadata', { ...object.metadata, ...options['metadata'] })
              } else {
                object.set(property, options[property])
              }
              fillColorObject(object, options)
              object.setCoords()
            })
          } else {
            if (property === 'metadata') {
              // @ts-ignore
              activeObject.set('metadata', { ...activeObject.metadata, ...options[property] })
            } else {
              // @ts-ignore
              activeObject.set(property, options[property])
            }
            fillColorObject(activeObject, options)
            activeObject.setCoords()
          }
        }
        // activeObject.set(property as keyof fabric.Object, options[property])
      }

      canvas.setActiveObject(activeObject)

      canvas.requestRenderAll()
      this.handlers.historyHandler.save('object:updated')
    }
  }

  public clear = () => {
    const frame = this.handlers.frameHandler.getFrame()
    this.canvas.getObjects().forEach(object => {
      if (object.type !== 'Frame') {
        this.canvas.remove(object)
      }
    })
    frame.set('fill', '#ffffff')
    this.canvas.renderAll()
  }

  public deselect = () => {
    this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
  }

  public select = object => {
    this.canvas.setActiveObject(object)
    this.context.setActiveObject(object)
    this.canvas.requestRenderAll()
  }

  public moveVertical = value => {
    const activeObject = this.canvas.getActiveObject()
    const top = activeObject.top + value
    this.update({
      top: top
    })
  }

  public moveHorizontal = value => {
    const activeObject = this.canvas.getActiveObject()
    const left = activeObject.left + value
    this.update({
      left: left
    })
  }

  public updateLineHeight = value => {
    const activeObject = this.canvas.getActiveObject() as fabric.ITextOptions
    if (activeObject.type === 'DynamicText') {
      const lineHeight = activeObject.lineHeight + value
      this.update({
        lineHeight: lineHeight
      })
    }
  }

  public updateCharSpacing = value => {
    const activeObject = this.canvas.getActiveObject() as fabric.ITextOptions
    if (activeObject.type === 'DynamicText') {
      const charSpacing = activeObject.charSpacing + value
      this.update({
        charSpacing: charSpacing
      })
    }
  }

  public cut = () => {
    this.copy()
    this.isCut = true
    this.remove()
  }

  public copy = () => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      this.clipboard = activeObject
    }
  }

  public clone = () => {
    if (this.canvas) {
      const activeObject = this.canvas.getActiveObject()
      const frame = this.handlers.frameHandler.getFrame()

      this.canvas.discardActiveObject()

      this.duplicate(activeObject, frame, duplicates => {
        const selection = new fabric.ActiveSelection(duplicates, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
        this.canvas.requestRenderAll()
      })
    }
  }

  private duplicate(
    object: fabric.Object,
    frame: fabric.Object,
    callback: (clones: fabric.Object[]) => void
  ): void {
    const setColorNestedObjects = (item: fabric.Object | any) => {
      ;((item as any)?._objects || []).forEach((object: any) => {
        if (item?.metadata?.fill || item.fill) {
          object.fill = item?.metadata?.fill || item.fill
        }
        if (item?.metadata?.stroke || item.stroke) {
          object.stroke = item?.metadata?.stroke || item.stroke
        }

        if (object) {
          setColorNestedObjects(object)
        }
      })
    }

    if (object instanceof fabric.Group && object.type !== ObjectType.STATIC_VECTOR) {
      const objects: fabric.Object[] = (object as fabric.Group).getObjects()
      const duplicates: fabric.Object[] = []
      for (let i = 0; i < objects.length; i++) {
        this.duplicate(objects[i], frame, clones => {
          duplicates.push(...clones)
          if (i == objects.length - 1) {
            callback(duplicates)
          }
        })
      }
    } else {
      object.clone(
        (clone: fabric.Object | any) => {
          clone.clipPath = null
          clone.set({
            left: object.left! + 10,
            top: object.top! + 10
          })

          if (this.config.clipToFrame) {
            const frame = this.handlers.frameHandler.getFrame()
            clone.clipPath = frame
          }

          setColorNestedObjects(clone)

          this.canvas.add(clone)

          callback([clone])
        },
        ['keyValues', 'src', 'metadata']
      )
    }
  }

  public paste = () => {
    const object = this.clipboard
    if (object) {
      const frame = this.handlers.frameHandler.getFrame()
      this.canvas.discardActiveObject()
      object.id = uuid()

      this.duplicate(object, frame, duplicates => {
        const selection = new fabric.ActiveSelection(duplicates, { canvas: this.canvas })

        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)

        this.canvas.requestRenderAll()
      })
    }
  }

  /**
   * Remove active object
   */

  public remove = () => {
    this.canvas.getActiveObjects().forEach(obj => {
      this.canvas.remove(obj)
    })
    this.canvas.discardActiveObject().renderAll()
    this.handlers.historyHandler.save('object:removed')
  }

  public selectAll = () => {
    this.canvas.discardActiveObject()
    const filteredObjects = this.canvas.getObjects().filter(object => {
      if (object.type === 'Frame') {
        return false
      } else if (!object.evented) {
        return false
        //@ts-ignore
      } else if (object.locked) {
        return false
      }
      return true
    })
    if (!filteredObjects.length) {
      return
    }
    if (filteredObjects.length === 1) {
      this.canvas.setActiveObject(filteredObjects[0])
      this.canvas.renderAll()
      this.context.setActiveObject(filteredObjects[0])
      return
    }
    const activeSelection = new fabric.ActiveSelection(filteredObjects, {
      canvas: this.canvas
    })
    this.canvas.setActiveObject(activeSelection)
    this.canvas.renderAll()
    this.context.setActiveObject(activeSelection)
  }

  public copyStyle = () => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      const clonableProps = copyStyleProps[activeObject.type]
      const clonedProps = pick(activeObject.toJSON(), clonableProps)

      this.copyStyleClipboard = {
        objectType: activeObject.type,
        props: clonedProps
      }

      this.handlers.backgroundHandler.setHoverCursor(getCopyStyleCursor())
      this.canvas.hoverCursor = getCopyStyleCursor()
      this.canvas.defaultCursor = getCopyStyleCursor()
    }
  }

  public pasteStyle = () => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject && this.copyStyleClipboard) {
      if (activeObject.type === this.copyStyleClipboard.objectType) {
        const { fill, ...basicProps } = this.copyStyleClipboard.props
        activeObject.set(basicProps)

        if (fill) {
          if (fill.type) {
            activeObject.set({ fill: new fabric.Gradient(fill) })
          } else {
            activeObject.set({ fill })
          }
        }
      }
    }
    this.copyStyleClipboard = null
    this.handlers.backgroundHandler.setHoverCursor('default')
    this.canvas.hoverCursor = 'move'
    this.canvas.defaultCursor = 'default'
  }
  /**
   * OBJECT POSITION
   */

  /**
   * Moves an object or a selection up in stack of drawn objects.
   */
  public bringForward = () => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      this.canvas.bringForward(activeObject)
    }
  }

  /**
   * Moves an object or the objects of a multiple selection to the top of the stack of drawn objects
   */
  public bringToFront = () => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      this.canvas.bringToFront(activeObject)
    }
  }

  /**
   * Moves an object or a selection down in stack of drawn objects.
   */
  public sendBackwards = () => {
    const objects = this.canvas.getObjects()
    const activeObject = this.canvas.getActiveObject()
    const index = objects.findIndex(o => o === activeObject)
    if (activeObject && index > 1) {
      this.canvas.sendBackwards(activeObject)
    }
  }

  /**
   * Moves an object to specified level in stack of drawn objects.
   */
  public sendToBack = () => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      activeObject.moveTo(1)
    }
  }

  /**
   * ALIGNMENT TO FRAME OR GROUP
   */

  /**
   * Moves an object to the top of the frame. If multiple objects are selected, will move all objects to the top of the selection.
   */
  public alignTop = () => {
    const activeObject = this.canvas.getActiveObject()
    const frame = this.handlers.frameHandler.getFrame()
    if (activeObject) {
      if (activeObject instanceof fabric.Group) {
        const selectedObjects = activeObject._objects
        const refTop = activeObject.top
        this.canvas.discardActiveObject()
        selectedObjects.forEach(object => {
          const currentObject = object
          currentObject.set('top', refTop)
        })
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
      } else {
        const currentObject = activeObject
        currentObject.set('top', frame.top)
      }
      this.canvas.requestRenderAll()
    }
  }
  /**
   * Moves an object to the middle of the frame. If multiple objects are selected, will move all objects to the middle of the selection.
   */
  public alignMiddle = () => {
    const activeObject = this.canvas.getActiveObject()
    const frame = this.handlers.frameHandler.getFrame()

    if (activeObject) {
      if (activeObject instanceof fabric.Group) {
        const selectedObjects = activeObject._objects
        const refTop = activeObject.top
        const refHeight = activeObject.height
        this.canvas.discardActiveObject()
        selectedObjects.forEach(object => {
          const currentObject = object
          const currentObjectHeight = currentObject.getScaledHeight()
          currentObject.set('top', refTop + refHeight / 2 - currentObjectHeight / 2)
        })
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
      } else {
        const currentObject = activeObject
        const currentObjectHeight = currentObject.getScaledHeight()
        currentObject.set('top', frame.top + frame.height / 2 - currentObjectHeight / 2)
      }
      this.canvas.requestRenderAll()
    }
  }
  /**
   * Moves an object to the bottom of the frame. If multiple objects are selected, will move all objects to the bottom of the selection.
   */
  public alignBottom = () => {
    const activeObject = this.canvas.getActiveObject()
    const frame = this.handlers.frameHandler.getFrame()

    if (activeObject) {
      if (activeObject instanceof fabric.Group) {
        const selectedObjects = activeObject._objects
        const refTop = activeObject.top
        const refHeight = activeObject.height
        this.canvas.discardActiveObject()
        selectedObjects.forEach(object => {
          const currentObject = object
          const currentObjectHeight = currentObject.getScaledHeight()
          currentObject.set('top', refTop + refHeight - currentObjectHeight)
        })
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
      } else {
        const currentObject = activeObject
        const currentObjectHeight = currentObject.getScaledHeight()
        currentObject.set('top', frame.top + frame.height - currentObjectHeight)
      }
      this.canvas.requestRenderAll()
    }
  }

  /**
   * Moves an object to the left of the frame. If multiple objects are selected, will move all objects to the left of the selection.
   */
  public alignLeft = () => {
    const activeObject = this.canvas.getActiveObject()
    const frame = this.handlers.frameHandler.getFrame()
    if (activeObject) {
      if (activeObject instanceof fabric.Group) {
        const selectedObjects = activeObject._objects
        const refLeft = activeObject.left
        this.canvas.discardActiveObject()
        selectedObjects.forEach(object => {
          const currentObject = object
          currentObject.set('left', refLeft)
        })
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
      } else {
        const currentObject = activeObject
        currentObject.set('left', frame.left)
      }
      this.canvas.requestRenderAll()
    }
  }

  /**
   * Moves an object to the center of the frame. If multiple objects are selected, will move all objects to the center of the selection.
   */
  public alignCenter = () => {
    const activeObject = this.canvas.getActiveObject()
    const frame = this.handlers.frameHandler.getFrame()

    if (activeObject) {
      if (activeObject instanceof fabric.Group) {
        const selectedObjects = activeObject._objects
        const refLeft = activeObject.left
        const refWidth = activeObject.width
        this.canvas.discardActiveObject()
        selectedObjects.forEach(object => {
          const currentObject = object
          const currentObjectWidth = currentObject.getScaledWidth()
          currentObject.set('left', refLeft + refWidth / 2 - currentObjectWidth / 2)
        })

        const selection = new fabric.ActiveSelection(selectedObjects, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
      } else {
        const currentObject = activeObject
        const currentObjectWidth = currentObject.getScaledWidth()
        currentObject.set('left', frame.left + frame.width / 2 - currentObjectWidth / 2)
      }
      this.canvas.requestRenderAll()
    }
  }

  /**
   * Moves an object to the right of the frame. If multiple objects are selected, will move all objects to the right of the selection.
   */
  public alignRight = () => {
    const activeObject = this.canvas.getActiveObject()
    const frame = this.handlers.frameHandler.getFrame()

    if (activeObject) {
      if (activeObject instanceof fabric.Group) {
        const selectedObjects = activeObject._objects
        const refLeft = activeObject.left
        const refWidth = activeObject.width
        this.canvas.discardActiveObject()
        selectedObjects.forEach(object => {
          const currentObject = object
          const currentObjectWidth = currentObject.getScaledWidth()
          currentObject.set('left', refLeft + refWidth - currentObjectWidth)
        })
        const selection = new fabric.ActiveSelection(selectedObjects, { canvas: this.canvas })
        this.canvas.setActiveObject(selection)
        this.context.setActiveObject(selection)
      } else {
        const currentObject = activeObject
        const currentObjectWidth = currentObject.getScaledWidth()
        currentObject.set('left', frame.left + frame.width - currentObjectWidth)
      }
      this.canvas.requestRenderAll()
    }
  }

  public distributesX = () => {
    var activeObject: any = this.canvas.getActiveObject()

    var totalWidth = activeObject.width
    var totalBoxesWidth = 0
    ;(activeObject?._objects || []).forEach(function(item) {
      totalBoxesWidth += item.getScaledWidth()
    })

    var objects = sortByLeft(activeObject?._objects || [])
    const objectSelected = [...objects]

    this.canvas.renderAll()

    let spacing = (totalWidth - totalBoxesWidth) / (objects.length - 1)
    var previousObject = objects.shift()
    objects.pop()

    this.canvas.discardActiveObject()
    objects.forEach(function(object) {
      object.set({
        left: previousObject.left + previousObject.width * previousObject.scaleX + spacing
      })
      object.setCoords()
      previousObject = object
    })

    const selection = new fabric.ActiveSelection(objectSelected, { canvas: this.canvas })
    this.canvas.setActiveObject(selection)
    this.context.setActiveObject(selection)

    this.canvas.requestRenderAll()
  }

  public distributesY = () => {
    var activeObject: any = this.canvas.getActiveObject()

    var totalHeight = activeObject.height
    var totalBoxesHeight = 0
    ;(activeObject?._objects || []).forEach(function(item) {
      totalBoxesHeight += item.getScaledHeight()
    })

    var objects = sortByTop(activeObject?._objects || [])
    const objectSelected = [...objects]

    this.canvas.renderAll()

    let spacing = (totalHeight - totalBoxesHeight) / (objects.length - 1)
    var previousObject = objects.shift()
    objects.pop()

    this.canvas.discardActiveObject()

    objects.forEach(function(object) {
      object.set({
        top: previousObject.top + previousObject.height * previousObject.scaleY + spacing
      })
      object.setCoords()
      previousObject = object
    })

    const selection = new fabric.ActiveSelection(objectSelected, { canvas: this.canvas })
    this.canvas.setActiveObject(selection)
    this.context.setActiveObject(selection)

    this.canvas.requestRenderAll()
  }

  /**
   * SHADOW
   */
  public setShadow = (options: ShadowOptions) => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject instanceof fabric.Group) {
      activeObject._objects.forEach(object => {
        this.setObjectShadow(object, options)
      })
    } else {
      this.setObjectShadow(activeObject, options)
    }
    this.canvas.requestRenderAll()
    this.handlers.historyHandler.save('object:updated')
  }

  private setObjectShadow = (object: fabric.Object, options: ShadowOptions) => {
    if (options.enabled) {
      object.set('shadow', new fabric.Shadow(options))
    } else {
      object.set('shadow', null)
    }
  }

  /**
   * GRADIENT
   */
  public setGradient = ({ angle, colors }: GradientOptions) => {
    const activeObject = this.canvas.getActiveObject()
    if (activeObject instanceof fabric.Group) {
      activeObject._objects.forEach(object => {
        this.setObjectGradient(object, angle, colors)
      })
    } else {
      this.setObjectGradient(activeObject, angle, colors)
    }
    this.canvas.requestRenderAll()
    this.handlers.historyHandler.save('object:updated')
  }

  private setObjectGradient = (object: fabric.Object, angle, colors) => {
    let odx = object.width >> 1
    let ody = object.height >> 1
    let startPoint = angleToPoint(angle, object.width, object.height)
    let endPoint = {
      x: object.width - startPoint.x,
      y: object.height - startPoint.y
    }
    object.set(
      'fill',
      new fabric.Gradient({
        type: 'linear',
        coords: {
          x1: startPoint.x - odx,
          y1: startPoint.y - ody,
          x2: endPoint.x - odx,
          y2: endPoint.y - ody
        },
        colorStops: [
          { offset: 0, color: colors[0] },
          { offset: 1, color: colors[1] }
        ]
      })
    )
  }
  public group = () => {
    const frame = this.handlers.frameHandler.getFrame()
    const activeObject = this.canvas.getActiveObject() as fabric.ActiveSelection
    if (!activeObject) {
      return
    }
    if (activeObject.type !== ObjectType.ACTIVE_SELECTION) {
      return
    }

    if (activeObject instanceof fabric.Group) {
      activeObject._objects.forEach(object => {
        object.clipPath = null
      })
    }
    const group = activeObject.toGroup()
    group.clipPath = frame
    group.type = ObjectType.GROUP
    group.id = uuid()
    this.canvas.renderAll()
    this.handlers.historyHandler.save('group')
  }

  public ungroup = () => {
    const frame = this.handlers.frameHandler.getFrame()
    const activeObject = this.canvas.getActiveObject() as fabric.ActiveSelection
    if (!activeObject) {
      return
    }
    if (activeObject.type !== ObjectType.GROUP) {
      return
    }
    const activeSelection = activeObject.toActiveSelection()
    activeSelection._objects.forEach(object => {
      object.clipPath = frame
    })

    delete activeSelection.clipPath
    delete activeSelection.type
    delete activeSelection.id

    this.canvas.renderAll()
    this.context.setActiveObject(activeSelection)

    this.handlers.historyHandler.save('ungroup')
  }

  public lock = () => {
    const activeObject = this.canvas.getActiveObject() as fabric.Object | fabric.ActiveSelection
    if (!activeObject) {
      return
    }

    // @ts-ignore
    if (activeObject._objects) {
      // @ts-ignore
      activeObject._objects.forEach(object => {
        object.set({ hasControls: false, lockMovementY: true, lockMovementX: true, locked: true })
      })
      activeObject.set({ hasControls: false, lockMovementY: true, lockMovementX: true, locked: true })
    } else {
      activeObject.set({ hasControls: false, lockMovementY: true, lockMovementX: true, locked: true })
    }
    this.canvas.renderAll()
    this.handlers.historyHandler.save('object:updated')
  }
  public unlock = () => {
    const activeObject = this.canvas.getActiveObject() as fabric.Object | fabric.ActiveSelection
    if (!activeObject) {
      return
    }

    // @ts-ignore
    if (activeObject._objects) {
      // @ts-ignore
      activeObject._objects.forEach(object => {
        object.set({ hasControls: true, lockMovementY: false, lockMovementX: false, locked: false })
      })
      // @ts-ignore
      activeObject.set({ hasControls: true, lockMovementY: false, lockMovementX: false, locked: false })
    } else {
      // @ts-ignore

      activeObject.set({ hasControls: true, lockMovementY: false, lockMovementX: false, locked: false })
    }
    this.canvas.renderAll()
    this.handlers.historyHandler.save('object:updated')
  }

  public findByName = (name: string) => {
    return this.canvas.getObjects().filter(o => o.name === name)
  }

  public removeByName = (name: string) => {
    this.canvas.getObjects().forEach(o => {
      if (o.name === name) {
        this.canvas.remove(o)
        this.handlers.historyHandler.save('object:removed')
      }
    })
    this.canvas.requestRenderAll()
  }

  public findById = (id: string) => {
    return this.canvas.getObjects().filter(o => o.id === id)
  }

  public removeById = (id: string) => {
    this.canvas.getObjects().forEach(o => {
      if (o.id === id) {
        this.canvas.remove(o)
        this.handlers.historyHandler.save('object:removed')
      }
    })
    this.canvas.requestRenderAll()
  }
}

export default ObjectHandler
