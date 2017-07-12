export * from './Clock.js'
export * from './Command.js'
export * from './Field.js'
export * from './Messages.js'
export * from './Plot.js'
export * from './Script.js'
export * from './Sequence.js'
export * from './Status.js'
export * from './TabSet.js'

import filter from 'lodash/filter'
import map    from 'lodash/map'

import { CommandDictionary } from '../cmd.js'
import { EVRDictionary     } from '../evr.js'
import { TelemetryDictionary, TelemetryStream } from '../tlm.js'


let Registry = { }

// NOTE: The `exports` symbol in the two lines below used to read
// `bliss.gui` before I moved this code inside the `bliss.gui` module.
// Looking at the Babel ES6 => ES5 transpiled code, `exports` resolves
// as the current module.  I'm not sure whether reyling on `exports`
// is valid ES6, but from my quick perusal of The ECMAScript 2015
// Language Specification, Section 9.4.6 Module Namespace Exotic
// Objects (p. 105), it just might be valid.

Object.keys(exports).map( (name) => {
    Registry['bliss-' + name.toLowerCase()] = exports[name]
})


/**
 * @returns a plain Javascript object representation of the HTML
 * element attributes in a DOM NamedNodeMap.  That is:
 *
 *     `<... name="value" ...>`
 *
 * pairs become:
 *
 * `{ ..., name: value, ... }`
 *
 * pairs.
 */
function attrs2obj (attrs) {
    let obj = { }

    for (let n = 0; n < attrs.length; ++n) {
        const item  = attrs.item(n)
        let   value = item.value

        if (value == 'true' ) value = true
        if (value == 'false') value = false

        obj[item.name] = value
    }

    return obj
}


/**
 * Creates a Mithril vnode for the given DOM element `elem`.
 *
 * @returns a Mithril vnode
 */
function createMithrilNode (elem) {
    let node = null

    if (elem.nodeType == Node.ELEMENT_NODE) {
        const name     = elem.nodeName.toLowerCase()
        const attrs    = attrs2obj(elem.attributes)
        const children = createMithrilNodes(elem.childNodes)

        node = m(Registry[name] || name, attrs, children)
    }
    else if (elem.nodeType == Node.TEXT_NODE) {
        node = elem.nodeValue;
    }

    return node
}


/**
 * Creates a Mithril vnode for each DOM element in `elems`.
 *
 * @returns an array of Mithril vnodes.
 */
function createMithrilNodes (elems) {
    return filter(map(elems, createMithrilNode), n => n !== null)
}


/**
 * Initializes the BLISS GUI.
 */
function init () {
    ready(() => {
        const root   = document.body
        const cloned = root.cloneNode(true)
        const elems  = map(cloned.childNodes, c => c)

        bliss.cmd         = { dict: {} }
        bliss.cmd.promise = m.request({ url: '/cmd/dict' })
        bliss.cmd.promise.then( (dict) => {
            bliss.cmd.dict = CommandDictionary.parse(dict)
        })

        m.request({ url: '/evr/dict' }).then( (dict) => {
            bliss.evr.dict = EVRDictionary.parse(dict)
        })

        m.request({ url: '/tlm/dict' }).then( (dict) => {
            const url = 'ws://' + location.host + '/tlm/realtime'

            bliss.tlm.dict   = TelemetryDictionary.parse(dict)
            bliss.tlm.stream = new TelemetryStream(url, bliss.tlm.dict)

            bliss.events.on('bliss:tlm:packet', () => {
                m.redraw()
            })
        })

        let source = new EventSource('/events');
        source.addEventListener('message', function (event) {
            let e = JSON.parse(event.data);
            bliss.events.emit(e.name, e.data)
        });

        m.mount(root, { view: () => createMithrilNodes(elems) })
    })
}


/**
 * Calls the given when the HTML document is loaded and ready.
 */
function ready (fn) {
    if (document.readyState !== 'loading') {
        fn();
    }
    else {
        document.addEventListener('DOMContentLoaded', fn);
    }
}

export { init }
