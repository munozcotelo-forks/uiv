import { request } from '../../utils/http.utils'
import { isString } from '../../utils/object.utils'
import {
  on,
  off,
  ensureElementMatchesFunction,
  EVENTS,
  getElementBySelectorOrRef
} from '../../utils/dom.utils'
import Dropdown from '../dropdown/Dropdown.js'

export default {
  components: { Dropdown },
  props: {
    value: {
      required: true
    },
    data: Array,
    itemKey: String,
    appendToBody: {
      type: Boolean,
      default: false
    },
    ignoreCase: {
      type: Boolean,
      default: true
    },
    matchStart: {
      type: Boolean,
      default: false
    },
    forceSelect: {
      type: Boolean,
      default: false
    },
    forceClear: {
      type: Boolean,
      default: false
    },
    limit: {
      type: Number,
      default: 10
    },
    asyncSrc: String,
    asyncKey: String,
    asyncFunction: Function,
    debounce: {
      type: Number,
      default: 200
    },
    openOnFocus: {
      type: Boolean,
      default: true
    },
    openOnEmpty: {
      type: Boolean,
      default: false
    },
    target: {
      required: true
    },
    preselect: {
      type: Boolean,
      default: true
    }
  },
  data () {
    return {
      inputEl: null,
      items: [],
      activeIndex: 0,
      timeoutID: 0,
      elements: [],
      open: false,
      dropdownMenuEl: null
    }
  },
  computed: {
    regexOptions () {
      let options = ''
      if (this.ignoreCase) {
        options += 'i'
      }
      if (!this.matchStart) {
        options += 'g'
      }
      return options
    }
  },
  mounted () {
    ensureElementMatchesFunction()
    this.$nextTick(() => {
      this.initInputElByTarget(this.target)
      this.initListeners()
      this.dropdownMenuEl = this.$refs.dropdown.$el.querySelector('.dropdown-menu')
      // set input text if v-model not empty
      if (this.value) {
        this.setInputTextByValue(this.value)
      }
    })
  },
  beforeDestroy () {
    this.removeListeners()
  },
  watch: {
    target (el) {
      this.removeListeners()
      this.initInputElByTarget(el)
      this.initListeners()
    },
    value (value) {
      this.setInputTextByValue(value)
    }
  },
  methods: {
    setInputTextByValue (value) {
      if (isString(value)) {
        // direct
        this.inputEl.value = value
      } else if (value) {
        // is object
        this.inputEl.value = this.itemKey ? value[this.itemKey] : value
      } else if (value === null) {
        // is null or undefined or something else not valid
        this.inputEl.value = ''
      }
    },
    hasEmptySlot () {
      return !!this.$slots.empty || !!this.$scopedSlots.empty
    },
    initInputElByTarget (target) {
      if (!target) {
        return
      }
      this.inputEl = getElementBySelectorOrRef(target)
    },
    initListeners () {
      if (this.inputEl) {
        this.elements = [this.inputEl]
        on(this.inputEl, EVENTS.FOCUS, this.inputFocused)
        on(this.inputEl, EVENTS.BLUR, this.inputBlured)
        on(this.inputEl, EVENTS.INPUT, this.inputChanged)
        on(this.inputEl, EVENTS.KEY_DOWN, this.inputKeyPressed)
      }
    },
    removeListeners () {
      this.elements = []
      if (this.inputEl) {
        off(this.inputEl, EVENTS.FOCUS, this.inputFocused)
        off(this.inputEl, EVENTS.BLUR, this.inputBlured)
        off(this.inputEl, EVENTS.INPUT, this.inputChanged)
        off(this.inputEl, EVENTS.KEY_DOWN, this.inputKeyPressed)
      }
    },
    prepareItems (data, disableFilters = false) {
      if (disableFilters) {
        this.items = data.slice(0, this.limit)
        return
      }
      this.items = []
      this.activeIndex = this.preselect ? 0 : -1
      for (let i = 0, l = data.length; i < l; i++) {
        const item = data[i]
        let key = this.itemKey ? item[this.itemKey] : item
        key = key.toString()
        let index = -1
        if (this.ignoreCase) {
          index = key.toLowerCase().indexOf(this.inputEl.value.toLowerCase())
        } else {
          index = key.indexOf(this.inputEl.value)
        }
        if (this.matchStart ? index === 0 : index >= 0) {
          this.items.push(item)
        }
        if (this.items.length >= this.limit) {
          break
        }
      }
    },
    fetchItems (value, debounce) {
      clearTimeout(this.timeoutID)
      if (value === '' && !this.openOnEmpty) {
        this.open = false
      } else if (this.data) {
        this.prepareItems(this.data)
        this.open = this.hasEmptySlot() || Boolean(this.items.length)
      } else if (this.asyncSrc) {
        this.timeoutID = setTimeout(() => {
          this.$emit('loading')
          request(this.asyncSrc + encodeURIComponent(value))
            .then(data => {
              if (this.inputEl.matches(':focus')) {
                this.prepareItems(this.asyncKey ? data[this.asyncKey] : data, true)
                this.open = this.hasEmptySlot() || Boolean(this.items.length)
              }
              this.$emit('loaded')
            })
            .catch(err => {
              console.error(err)
              this.$emit('loaded-error')
            })
        }, debounce)
      } else if (this.asyncFunction) {
        const cb = (data) => {
          if (this.inputEl.matches(':focus')) {
            this.prepareItems(data, true)
            this.open = this.hasEmptySlot() || Boolean(this.items.length)
          }
          this.$emit('loaded')
        }
        this.timeoutID = setTimeout(() => {
          this.$emit('loading')
          this.asyncFunction(value, cb)
        }, debounce)
      }
    },
    inputChanged () {
      const value = this.inputEl.value
      this.fetchItems(value, this.debounce)
      this.$emit('input', this.forceSelect ? undefined : value)
    },
    inputFocused () {
      if (this.openOnFocus) {
        const value = this.inputEl.value
        this.fetchItems(value, 0)
      }
    },
    inputBlured () {
      if (!this.dropdownMenuEl.matches(':hover')) {
        this.open = false
      }
      if (this.inputEl && this.forceClear) {
        this.$nextTick(() => {
          if (typeof this.value === 'undefined') {
            this.inputEl.value = ''
          }
        })
      }
    },
    inputKeyPressed (event) {
      event.stopPropagation()
      if (this.open) {
        switch (event.keyCode) {
          case 13:
            if (this.activeIndex >= 0) {
              this.selectItem(this.items[this.activeIndex])
            } else {
              this.open = false
            }
            event.preventDefault()
            break
          case 27:
            this.open = false
            break
          case 38:
            this.activeIndex = this.activeIndex > 0 ? this.activeIndex - 1 : 0
            break
          case 40: {
            const maxIndex = this.items.length - 1
            this.activeIndex = this.activeIndex < maxIndex ? this.activeIndex + 1 : maxIndex
            break
          }
        }
      }
    },
    selectItem (item) {
      this.$emit('input', item)
      this.open = false
    },
    highlight (item) {
      const value = this.itemKey ? item[this.itemKey] : item
      const inputValue = this.inputEl.value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
      return value.replace(new RegExp(`${inputValue}`, this.regexOptions), '<b>$&</b>')
    }
  }
}
