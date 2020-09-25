import { h, defineComponent, withDirectives, Transition } from 'vue'

import QIcon from '../icon/QIcon.js'
import QSpinner from '../spinner/QSpinner.js'

import Ripple from '../../directives/Ripple.js'

import BtnMixin from '../../mixins/btn.js'

import { mergeSlot } from '../../utils/slot.js'
import { stop, prevent, stopAndPrevent, listenOpts, noop } from '../../utils/event.js'
import { getTouchTarget } from '../../utils/touch.js'
import { isKeyCode } from '../../utils/key-composition.js'

const { passiveCapture } = listenOpts

let
  touchTarget = void 0,
  keyboardTarget = void 0,
  mouseTarget = void 0

const iconAttrs = { role: 'img', 'aria-hidden': 'true' }

export default defineComponent({
  name: 'QBtn',

  mixins: [ BtnMixin ],

  props: {
    percentage: Number,
    darkPercentage: Boolean
  },

  emits: [ 'click', 'keydown', 'touchstart', 'mousedown', 'keyup' ],

  computed: {
    hasLabel () {
      return this.label !== void 0 && this.label !== null && this.label !== ''
    },

    computedRipple () {
      return this.ripple === false
        ? false
        : {
          keyCodes: this.isLink === true ? [ 13, 32 ] : [ 13 ],
          ...(this.ripple === true ? {} : this.ripple)
        }
    },

    percentageStyle () {
      const val = Math.max(0, Math.min(100, this.percentage))
      if (val > 0) {
        return { transition: 'transform 0.6s', transform: `translateX(${val - 100}%)` }
      }
    },

    onEvents () {
      if (this.loading === true) {
        return {
          onMousedown: this.__onLoadingEvt,
          onTouchstart: this.__onLoadingEvt,
          onClick: this.__onLoadingEvt,
          onKeydown: this.__onLoadingEvt,
          onKeyup: this.__onLoadingEvt
        }
      }
      else if (this.isActionable === true) {
        const evts = {
          // TODO vue3 - disable any events if loading (above)
          // ...this.qListeners,
          onClick: this.click,
          onKeydown: this.__onKeydown,
          onMousedown: this.__onMousedown
        }

        if (this.$q.platform.has.touch === true) {
          evts.onTouchstart = this.__onTouchstart
        }

        return evts
      }

      return {}
    },

    directives () {
      if (this.disable !== true && this.ripple !== false) {
        return [[
          Ripple,
          this.computedRipple,
          void 0,
          { center: this.round }
        ]]
      }
    }
  },

  methods: {
    click (e) {
      if (e !== void 0) {
        if (e.defaultPrevented === true) {
          return
        }

        const el = document.activeElement
        // focus button if it came from ENTER on form
        // prevent the new submit (already done)
        if (
          this.type === 'submit' &&
          (
            (this.$q.platform.is.ie === true && (e.clientX < 0 || e.clientY < 0)) ||
            (
              el !== document.body &&
              this.$el.contains(el) === false &&
              // required for iOS and desktop Safari
              el.contains(this.$el) === false
            )
          )
        ) {
          this.$el.focus()

          const onClickCleanup = () => {
            document.removeEventListener('keydown', stopAndPrevent, true)
            document.removeEventListener('keyup', onClickCleanup, passiveCapture)
            this.$el !== void 0 && this.$el.removeEventListener('blur', onClickCleanup, passiveCapture)
          }

          document.addEventListener('keydown', stopAndPrevent, true)
          document.addEventListener('keyup', onClickCleanup, passiveCapture)
          this.$el.addEventListener('blur', onClickCleanup, passiveCapture)
        }

        if (this.hasRouterLink === true) {
          if (
            e.ctrlKey === true ||
            e.shiftKey === true ||
            e.altKey === true ||
            e.metaKey === true
          ) {
            // if it has meta keys, let vue-router link
            // handle this by its own
            return
          }

          stopAndPrevent(e)
        }
      }

      const go = () => {
        // vue-router now throwing error if navigating
        // to the same route that the user is currently at
        // https://github.com/vuejs/vue-router/issues/2872
        // TODO vue3 - review replace() / push(); 2nd & 3rd param??
        this.$router[this.replace === true ? 'replace' : 'push'](this.to, void 0, noop)
      }

      this.$emit('click', e, go)
      this.hasRouterLink === true && e.navigate !== false && go()
    },

    __onKeydown (e) {
      if (isKeyCode(e, [ 13, 32 ]) === true) {
        stopAndPrevent(e)

        if (keyboardTarget !== this.$el) {
          keyboardTarget !== void 0 && this.__cleanup()

          // focus external button if the focus helper was focused before
          this.$el.focus()

          keyboardTarget = this.$el
          this.$el.classList.add('q-btn--active')
          document.addEventListener('keyup', this.__onPressEnd, true)
          this.$el.addEventListener('blur', this.__onPressEnd, passiveCapture)
        }
      }

      this.$emit('keydown', e)
    },

    __onTouchstart (e) {
      if (touchTarget !== this.$el) {
        touchTarget !== void 0 && this.__cleanup()
        touchTarget = this.$el
        const target = this.touchTargetEl = getTouchTarget(e.target)
        target.addEventListener('touchcancel', this.__onPressEnd, passiveCapture)
        target.addEventListener('touchend', this.__onPressEnd, passiveCapture)
      }

      // avoid duplicated mousedown event
      // triggering another early ripple
      this.avoidMouseRipple = true
      clearTimeout(this.mouseTimer)
      this.mouseTimer = setTimeout(() => {
        this.avoidMouseRipple = false
      }, 200)

      this.$emit('touchstart', e)
    },

    __onMousedown (e) {
      if (mouseTarget !== this.$el) {
        mouseTarget !== void 0 && this.__cleanup()
        mouseTarget = this.$el
        this.$el.classList.add('q-btn--active')
        document.addEventListener('mouseup', this.__onPressEnd, passiveCapture)
      }

      e.qSkipRipple = this.avoidMouseRipple === true
      this.$emit('mousedown', e)
    },

    __onPressEnd (e) {
      // needed for IE (because it emits blur when focusing button from focus helper)
      if (e !== void 0 && e.type === 'blur' && document.activeElement === this.$el) {
        return
      }

      if (e !== void 0 && e.type === 'keyup') {
        if (keyboardTarget === this.$el && isKeyCode(e, [ 13, 32 ]) === true) {
          // for click trigger
          const evt = new MouseEvent('click', e)
          evt.qKeyEvent = true
          e.defaultPrevented === true && prevent(evt)
          e.cancelBubble === true && stop(evt)
          this.$el.dispatchEvent(evt)

          stopAndPrevent(e)

          // for ripple
          e.qKeyEvent = true
        }

        this.$emit('keyup', e)
      }

      this.__cleanup()
    },

    __cleanup (destroying) {
      const blurTarget = this.$refs.blurTarget

      if (
        destroying !== true &&
        (touchTarget === this.$el || mouseTarget === this.$el) &&
        blurTarget !== void 0 &&
        blurTarget !== document.activeElement
      ) {
        blurTarget.setAttribute('tabindex', -1)
        blurTarget.focus()
      }

      if (touchTarget === this.$el) {
        const target = this.touchTargetEl
        target.removeEventListener('touchcancel', this.__onPressEnd, passiveCapture)
        target.removeEventListener('touchend', this.__onPressEnd, passiveCapture)
        touchTarget = this.touchTargetEl = void 0
      }

      if (mouseTarget === this.$el) {
        document.removeEventListener('mouseup', this.__onPressEnd, passiveCapture)
        mouseTarget = void 0
      }

      if (keyboardTarget === this.$el) {
        document.removeEventListener('keyup', this.__onPressEnd, true)
        this.$el !== void 0 && this.$el.removeEventListener('blur', this.__onPressEnd, passiveCapture)
        keyboardTarget = void 0
      }

      this.$el !== void 0 && this.$el.classList.remove('q-btn--active')
    },

    __onLoadingEvt (evt) {
      stopAndPrevent(evt)
      evt.qSkipRipple = true
    }
  },

  beforeUnmount () {
    this.__cleanup(true)
  },

  render () {
    let inner = []

    this.icon !== void 0 && inner.push(
      h(QIcon, {
        ...iconAttrs,
        name: this.icon,
        left: this.stack === false && this.hasLabel === true
      })
    )

    this.hasLabel === true && inner.push(
      h('span', { class: 'block' }, [ this.label ])
    )

    inner = mergeSlot(inner, this, 'default')

    if (this.iconRight !== void 0 && this.round === false) {
      inner.push(
        h(QIcon, {
          ...iconAttrs,
          name: this.iconRight,
          right: this.stack === false && this.hasLabel === true
        })
      )
    }

    const child = [
      h('span', {
        class: 'q-focus-helper',
        ref: 'blurTarget'
      })
    ]

    if (this.loading === true && this.percentage !== void 0) {
      child.push(
        h('span', {
          class: 'q-btn__progress absolute-full overflow-hidden'
        }, [
          h('span', {
            class: 'q-btn__progress-indicator fit block' + (this.darkPercentage === true ? ' q-btn__progress--dark' : ''),
            style: this.percentageStyle
          })
        ])
      )
    }

    child.push(
      h('span', {
        class: 'q-btn__wrapper col row q-anchor--skip',
        style: this.wrapperStyle
      }, [
        h('span', {
          class: 'q-btn__content text-center col items-center q-anchor--skip ' + this.innerClasses
        }, inner)
      ])
    )

    this.loading !== null && child.push(
      h(Transition, {
        name: 'q-transition--fade'
      }, {
        default: () => this.loading === true ? [
          h('span', {
            key: 'loading',
            class: 'absolute-full flex flex-center'
          }, this.$slots.loading !== void 0 ? this.$slots.loading() : [ h(QSpinner) ])
        ] : void 0
      })
    )

    const node = h(this.isLink === true ? 'a' : 'button', {
      class: 'q-btn q-btn-item non-selectable no-outline ' + this.classes,
      style: this.style,
      ...this.attrs,
      ...this.onEvents
    }, child)

    return this.directives !== void 0
      ? withDirectives(node, this.directives)
      : node
  }
})
