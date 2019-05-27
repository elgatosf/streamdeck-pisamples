// this is our global websocket, used to communicate from/to Stream Deck software
// and some info about our plugin, as sent by Stream Deck software
var websocket = null,
    uuid = null,
    actionInfo = {},
    inInfo = {},
    runningApps = [],
    settings = {},
    isQT = navigator.appVersion.includes('QtWebEngine'),
    onchangeevt = 'onchange'; // 'oninput'; // change this, if you want interactive elements act on any change, or while they're modified

function connectElgatoStreamDeckSocket (inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    // please note: the incoming arguments are of type STRING, so
    // in case of the inActionInfo, we must parse it into JSON first
    actionInfo = JSON.parse(inActionInfo); // cache the info
    inInfo = JSON.parse(inInfo);
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    /** Since the PI doesn't have access to your OS native settings
     * Stream Deck sends some color settings to PI
     * We use these to adjust some styles (e.g. highlight-colors for checkboxes)
     */
    addDynamicStyles(inInfo.colors, 'connectElgatoStreamDeckSocket');
    
    /** let's see, if we have some settings */
    settings = getPropFromString(actionInfo, 'payload.settings', false);
    console.log(settings, actionInfo);
    initPropertyInspector(5);

    // if connection was established, the websocket sends
    // an 'onopen' event, where we need to register our PI
    websocket.onopen = function () {
        var json = {
            event: inRegisterEvent,
            uuid: inUUID
        };
        // register property inspector to Stream Deck
        websocket.send(JSON.stringify(json));
        // demoCanvas();
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        var jsonObj = JSON.parse(evt.data);
        var event = jsonObj['event'];
        if (getPropFromString(jsonObj, 'payload.runningApps') && event === 'sendToPropertyInspector') {
            sdpiCreateList(document.querySelector('#runningAppsContainer'), {
                id: 'runningAppsID',
                label: 'Running Apps',
                value: jsonObj.payload.runningApps,
                type: 'list',
                selectionType: 'no-select'
            });
        }
    };
}

window.addEventListener('message',function(ev) {
    console.log('External window received message:  ', ev.data, typeof ev.data);
    if (ev.data === 'initPropertyInspector') {
        initPropertyInspector(5);
    }
},false);

function openMeExternal() {
    window.xtWindow = window.open('index_pi.html', "PI Samples");
    setTimeout(() => window.xtWindow.postMessage('initPropertyInspector', '*'), 1500);
}

function initPropertyInspector(initDelay) {
    prepareDOMElements(document);
    demoCanvas();
    /** expermimental carousel is not part of the DOM
     * so let the DOM get constructed first and then
     * inject the carousel */
    setTimeout(function () {
        initCarousel();
        initToolTips();
    }, initDelay || 100);
}

function revealSdpiWrapper () {
    const el = document.querySelector('.sdpi-wrapper');
    el && el.classList.remove('hidden');
}

// our method to pass values to the plugin
function sendValueToPlugin (value, param) {
    if (websocket && (websocket.readyState === 1)) {
        const json = {
            'action': actionInfo['action'],
            'event': 'sendToPlugin',
            'context': uuid,
            'payload': {
                [param]: value
            }
        };
        websocket.send(JSON.stringify(json));
    }
}

if (!isQT) {
    document.addEventListener('DOMContentLoaded', function () {
        initPropertyInspector(100);
    });
}

/** the beforeunload event is fired, right before the PI will remove all nodes */
window.addEventListener('beforeunload', function (e) {
    e.preventDefault();
    // since 4.1 this is no longer needed, as the plugin will receive a notification
    // right before the Property Inspector goes away
    sendValueToPlugin('propertyInspectorWillDisappear', 'property_inspector');
    // Don't set a returnValue to the event, otherwise Chromium with throw an error.  // e.returnValue = '';
});

/** the pagehide event is fired, when the view disappears */
/*
window.addEventListener('pagehide', function (event) {
    console.log('%c%s','background: green; font-size: 22px; font-weight: bold;','window --->> pagehide.');
    sendValueToPlugin('propertyInspectorPagehide', 'property_inspector');

});
*/

/** the unload event is fired, when the PI will finally disappear */
/*
window.addEventListener('unload', function (event) {
    console.log('%c%s','background: orange; font-size: 22px; font-weight: bold;','window --->> onunload.');
    sendValueToPlugin('propertyInspectorDisconnected', 'property_inspector');
});
*/

/** if you prefer, you can apply these listeners to PI's body, like so:
 *
 * <body onpagehide="sendValueToPlugin('propertyInspectorPagehide', 'property_inspector');">
 *
 * <body onunload="sendValueToPlugin('propertyInspectorDisconnected', 'property_inspector');">
*/

/** CREATE INTERACTIVE HTML-DOM
 * where elements can be clicked or act on their 'change' event.
 * Messages are then processed using the 'handleSdpiItemClick' method below.
 */

function prepareDOMElements(baseElement) {
    baseElement = baseElement || document;
    Array.from(baseElement.querySelectorAll('.sdpi-item-value')).forEach(
        (el, i) => {
            const elementsToClick = [
                'BUTTON',
                'OL',
                'UL',
                'TABLE',
                'METER',
                'PROGRESS',
                'CANVAS'
            ].includes(el.tagName);
            const evt = elementsToClick ? 'onclick' : onchangeevt || 'onchange';

            /** Look for <input><span> combinations, where we consider the span as label for the input
             * we don't use `labels` for that, because a range could have 2 labels.
             */
            const inputGroup = el.querySelectorAll('input + span');
            if (inputGroup.length === 2) {
                const offs = inputGroup[0].tagName === 'INPUT' ? 1 : 0;
                inputGroup[offs].textContent = inputGroup[1 - offs].value;
                inputGroup[1 - offs]['oninput'] = function() {
                    inputGroup[offs].textContent = inputGroup[1 - offs].value;
                };
            }
            /** We look for elements which have an 'clickable' attribute
             * we use these e.g. on an 'inputGroup' (<span><input type="range"><span>) to adjust the value of
             * the corresponding range-control
             */
            Array.from(el.querySelectorAll('.clickable')).forEach(
                (subel, subi) => {
                    subel['onclick'] = function(e) {
                        handleSdpiItemChange(e.target, subi);
                    };
                }
            );
            /** Just in case the found HTML element already has an input or change - event attached, 
             * we clone it, and call it in the callback, right before the freshly attached event
            */
            const cloneEvt = el[evt];
            el[evt] = function(e) {
                if (cloneEvt) cloneEvt();
                handleSdpiItemChange(e.target, i);
            };
        }
    );

    /**
     * You could add a 'label' to a textares, e.g. to show the number of charactes already typed
     * or contained in the textarea. This helper updates this label for you.
     */
    baseElement.querySelectorAll('textarea').forEach((e) => {
        const maxl = e.getAttribute('maxlength');
        e.targets = baseElement.querySelectorAll(`[for='${e.id}']`);
        if (e.targets.length) {
            let fn = () => {
                for (let x of e.targets) {
                    x.textContent = maxl ? `${e.value.length}/${maxl}` : `${e.value.length}`;
                }
            };
            fn();
            e.onkeyup = fn;
        }
    });

    baseElement.querySelectorAll('[data-open-url]').forEach(e => {
        const value = e.getAttribute('data-open-url');
        if (value) {
            e.onclick = () => {
                let path;
                if (value.indexOf('http') !== 0) {
                    path = document.location.href.split('/');
                    path.pop();
                    path.push(value.split('/').pop());
                    path = path.join('/');
                } else {
                    path = value;
                }
                $SD.api.openUrl($SD.uuid, path);
            };
        } else {
            console.log(`${value} is not a supported url`);
        }
    });
}

function handleSdpiItemChange(e, idx) {

    /** Following items are containers, so we won't handle clicks on them */
    
    if (['OL', 'UL', 'TABLE'].includes(e.tagName)) {
        return;
    }

    /** SPANS are used inside a control as 'labels'
     * If a SPAN element calls this function, it has a class of 'clickable' set and is thereby handled as
     * clickable label.
     */

    if (e.tagName === 'SPAN') {
        const inp = e.parentNode.querySelector('input');
        var tmpValue;
        
        // if there's no attribute set for the span, try to see, if there's a value in the textContent
        // and use it as value
        if (!e.hasAttribute('value')) {
               tmpValue = Number(e.textContent);
            if (typeof tmpValue === 'number' && tmpValue !== null) {
                e.setAttribute('value', 0+tmpValue); // this is ugly, but setting a value of 0 on a span doesn't do anything
                e.value = tmpValue; 
            }
        } else {
            tmpValue = Number(e.getAttribute('value'));
        }
        
        if (inp && tmpValue !== undefined) {
            inp.value = tmpValue;
        } else return;
    }

    const selectedElements = [];
    const isList = ['LI', 'OL', 'UL', 'DL', 'TD'].includes(e.tagName);
    const sdpiItem = e.closest('.sdpi-item');
    const sdpiItemGroup = e.closest('.sdpi-item-group');
    let sdpiItemChildren = isList
        ? sdpiItem.querySelectorAll(e.tagName === 'LI' ? 'li' : 'td')
        : sdpiItem.querySelectorAll('.sdpi-item-child > input');

    if (isList) {
        const siv = e.closest('.sdpi-item-value');
        if (!siv.classList.contains('multi-select')) {
            for (let x of sdpiItemChildren) x.classList.remove('selected');
        }
        if (!siv.classList.contains('no-select')) {
            e.classList.toggle('selected');
        }
    }
  
    if (sdpiItemChildren.length && ['radio','checkbox'].includes(sdpiItemChildren[0].type)) {
        e.setAttribute('_value', e.checked); //'_value' has priority over .value
    }
    if (sdpiItemGroup && !sdpiItemChildren.length) {
        for (let x of ['input', 'meter', 'progress']) {
            sdpiItemChildren = sdpiItemGroup.querySelectorAll(x);
            if (sdpiItemChildren.length) break;
        }
    }

    if (e.selectedIndex) {
        idx = e.selectedIndex;
    } else {
        sdpiItemChildren.forEach((ec, i) => {
            if (ec.classList.contains('selected')) {
                selectedElements.push(ec.textContent);
            }
            if (ec === e) {
                idx = i;
                selectedElements.push(ec.value);
            }
        });
    }

    const returnValue = {
        key: e.id && e.id.charAt(0) !== '_' ? e.id : sdpiItem.id,
        value: isList
            ? e.textContent
            : e.hasAttribute('_value')
            ? e.getAttribute('_value')
            : e.value
            ? e.type === 'file'
                ? decodeURIComponent(e.value.replace(/^C:\\fakepath\\/, ''))
                : e.value
            : e.getAttribute('value'),
        group: sdpiItemGroup ? sdpiItemGroup.id : false,
        index: idx,
        selection: selectedElements,
        checked: e.checked
    };

    /** Just simulate the original file-selector:
     * If there's an element of class '.sdpi-file-info'
     * show the filename there
     */
    if (e.type === 'file') {
        const info = sdpiItem.querySelector('.sdpi-file-info');
        if (info) {
            const s = returnValue.value.split('/').pop();
            info.textContent =                s.length > 28
                    ? s.substr(0, 10)
                      + '...'
                      + s.substr(s.length - 10, s.length)
                    : s;
        }
    }

    sendValueToPlugin(returnValue, 'sdpi_collection');
}

function updateKeyForDemoCanvas (cnv) {
    sendValueToPlugin({
        key: 'your_canvas',
        value: cnv.toDataURL()
    }, 'sdpi_collection');
}

/** Stream Deck software passes system-highlight color information
 * to Property Inspector. Here we 'inject' the CSS styles into the DOM
 * when we receive this information. */


function addDynamicStyles (clrs, fromWhere) {
    const node = document.getElementById('#sdpi-dynamic-styles') || document.createElement('style');
    if (!clrs.mouseDownColor) clrs.mouseDownColor = fadeColor(clrs.highlightColor, -100);
    const clr = clrs.highlightColor.slice(0, 7);
    const clr1 = fadeColor(clr, 100);
    const clr2 = fadeColor(clr, 60);
    const metersActiveColor = fadeColor(clr, -60);

    node.setAttribute('id', 'sdpi-dynamic-styles');
    node.innerHTML = `

    input[type="radio"]:checked + label span,
    input[type="checkbox"]:checked + label span {
        background-color: ${clrs.highlightColor};
    }

    input[type="radio"]:active:checked + label span,
    input[type="radio"]:active + label span,
    input[type="checkbox"]:active:checked + label span,
    input[type="checkbox"]:active + label span {
      background-color: ${clrs.mouseDownColor};
    }

    input[type="radio"]:active + label span,
    input[type="checkbox"]:active + label span {
      background-color: ${clrs.buttonPressedBorderColor};
    }

    td.selected,
    td.selected:hover,
    li.selected:hover,
    li.selected {
      color: white;
      background-color: ${clrs.highlightColor};
    }

    .sdpi-file-label > label:active,
    .sdpi-file-label.file:active,
    label.sdpi-file-label:active,
    label.sdpi-file-info:active,
    input[type="file"]::-webkit-file-upload-button:active,
    button:active {
      background-color: ${clrs.buttonPressedBackgroundColor};
      color: ${clrs.buttonPressedTextColor};
      border-color: ${clrs.buttonPressedBorderColor};
    }

    ::-webkit-progress-value,
    meter::-webkit-meter-optimum-value {
        background: linear-gradient(${clr2}, ${clr1} 20%, ${clr} 45%, ${clr} 55%, ${clr2})
    }

    ::-webkit-progress-value:active,
    meter::-webkit-meter-optimum-value:active {
        background: linear-gradient(${clr}, ${clr2} 20%, ${metersActiveColor} 45%, ${metersActiveColor} 55%, ${clr})
    }
    `;
    document.body.appendChild(node);
};

/** UTILITIES */

/** Helper function to construct a list of running apps
 * from a template string.
 * -> information about running apps is received from the plugin
 */

function sdpiCreateList (el, obj, cb) {
    if (el) {
        el.style.display = obj.value.length ? 'block' : 'none';
        Array.from(document.querySelectorAll(`.${el.id}`)).forEach((subel, i) => {
            subel.style.display = obj.value.length ? 'flex' : 'none';
        });
        if (obj.value.length) {
            el.innerHTML = `<div class="sdpi-item" ${obj.type ? `class="${obj.type}"` : ''} id="${obj.id || window.btoa(new Date().getTime().toString()).substr(0, 8)}">
            <div class="sdpi-item-label">${obj.label || ''}</div>
            <ul class="sdpi-item-value ${obj.selectionType ? obj.selectionType : ''}">
                    ${obj.value.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>`;
            setTimeout(function () {
                prepareDOMElements(el);
                if (cb) cb();
            }, 10);
            return;
        }
    }
    if (cb) cb();
};

/** get a JSON property from a (dot-separated) string
 * Works on nested JSON, e.g.:
 * jsn = {
 *      propA: 1,
 *      propB: 2,
 *      propC: {
 *          subA: 3,
 *          subB: {
 *             testA: 5,
 *             testB: 'Hello'
 *          }
 *      }
 *  }
 *  getPropFromString(jsn,'propC.subB.testB') will return 'Hello';
 */
const getPropFromString = (jsn, str, sep = '.') => {
    const arr = str.split(sep);
    return arr.reduce((obj, key) =>
        (obj && obj.hasOwnProperty(key)) ? obj[key] : undefined, jsn);
};

/*
    Quick utility to lighten or darken a color (doesn't take color-drifting, etc. into account)
    Usage:
    fadeColor('#061261', 100); // will lighten the color
    fadeColor('#200867'), -100); // will darken the color
*/
function fadeColor (col, amt) {
    const min = Math.min, max = Math.max;
    const num = parseInt(col.replace(/#/g, ''), 16);
    const r = min(255, max((num >> 16) + amt, 0));
    const g = min(255, max((num & 0x0000FF) + amt, 0));
    const b = min(255, max(((num >> 8) & 0x00FF) + amt, 0));
    return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, 0);
}

/** Quick utility to inject a style to the DOM
 * e.g. injectStyle('.localbody { background-color: green;}')
 */
function injectStyle (clrs) {
    const node = document.createElement('style');
    const tempID = window.btoa(new Date().getTime().toString()).slice(10, 18);
    node.setAttribute('id', tempID);
    node.innerHTML = clrs;
    document.body.appendChild(node);
    return tempID;
};

/** Quick utility to return a random color.
 * If the randomly generated string is less than 6 characters
 * pad it with '0'
 */
function randomColor (prefix) {
    return (prefix || '') + (((1 << 24) * Math.random()) | 0).toString(16).padStart(6, 0); // just a random color padded to 6 characters
}

/** CANVAS DEMO */

function demoCanvas () {
    const touchDevice = (('ontouchstart' in document.documentElement) && (navigator.platform != 'Win32'));
    const evtDown = touchDevice ? 'touchstart' : 'mousedown';
    const evtMove = touchDevice ? 'touchmove' : 'mousemove';
    const evtEnd = touchDevice ? 'touchend' : 'mouseup';
    const evtX = touchDevice ? 'pageX' : 'clientX';
    const evtY = touchDevice ? 'pageY' : 'clientY';

    const cnv = document.querySelector('canvas');
    if (!cnv) return;
    const ctx = cnv.getContext('2d');
    if (!ctx) return;
    function drawRandomCanvas () {
        const rad = cnv.height / 4;
        const cX = Math.random() * cnv.width;
        const cY = Math.random() * cnv.height;

        const grad = ctx.createLinearGradient(0, 0, 0, 170);
        const clr = randomColor();
        grad.addColorStop(0, fadeColor(clr, -100));
        grad.addColorStop(0.5, '#' + clr);
        grad.addColorStop(1, fadeColor(clr, 100));
        ctx.fillStyle = grad;

        //  ctx.fillStyle = randomColor();
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        ctx.beginPath();
        ctx.arc(cX, cY, rad, 0, 2 * Math.PI, false);
        ctx.fillStyle = '#' + randomColor();
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#' + randomColor();
        ctx.stroke();
    }

    drawRandomCanvas();

    const pos = { x: 0, y: 0 };

    var el = document.querySelector('.sdpi-wrapper');
    cnv.addEventListener(evtDown, function (e) {
        if (e.shiftKey) {
            drawRandomCanvas();
            return;
        }
        pos.x = e[evtX] - cnv.offsetLeft + el.scrollLeft;
        pos.y = e[evtY] - cnv.offsetTop + el.scrollTop;
    });

    cnv.addEventListener(evtEnd, function (e) {
        e.target.value = cnv.toDataURL();
    });

    cnv.addEventListener(evtMove, function (e) {
        if (!touchDevice) {
            if (!e.altKey || e.buttons !== 1) return;
        }
        e.preventDefault();

        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#061261';
        ctx.moveTo(pos.x, pos.y); // from
        pos.x = e[evtX] - cnv.offsetLeft + el.scrollLeft;
        pos.y = e[evtY] - cnv.offsetTop + el.scrollTop;
        ctx.lineTo(pos.x, pos.y); // to
        ctx.stroke();
    });

    updateKeyForDemoCanvas(cnv, cnv);
}

/** EXPERIMENTAL CAROUSEL  */

function initCarousel () {
    document.querySelectorAll('.sdpi-item [type=carousel]').forEach((e, i, a) => {
        var m = e.querySelector('img');
        e.data = {
            currentOffset: 0,
            visibleCards: 3,
            scrollDistance: m ? m.clientWidth + 10 : 70,
            numCards: e.querySelectorAll('.card-carousel--card').length,
            leftNav: e.querySelectorAll('.card-carousel--nav__left'),
            rightNav: e.querySelectorAll('.card-carousel--nav__right'),
            atStart: true,
            atEnd: false
        };

        e.end = function () {
            return e.data.currentOffset <= (e.data.scrollDistance * -1) * (e.data.numCards - e.data.visibleCards);
        };

        const cards = e.querySelector('.card-carousel-cards');

        e.move = function (direction) {
            if (direction === 1 && !this.data.atEnd) {
                this.data.currentOffset -= this.data.scrollDistance;
            } else if (direction === -1 && !this.data.atStart) {
                this.data.currentOffset += this.data.scrollDistance;
            }

            if (cards) {
                cards.setAttribute('style', `transform:translateX(${this.data.currentOffset}px)`);
                this.data.atStart = this.data.currentOffset === 0;
                this.data.atEnd = this.end();
                this.data.leftNav.forEach((ctl) => {
                    if (!this.data.atStart) ctl.removeAttribute('disabled');
                    else ctl.setAttribute('disabled', this.data.atStart);
                });
                this.data.rightNav.forEach((ctl) => {
                    if (!this.data.atEnd) ctl.removeAttribute('disabled');
                    else ctl.setAttribute('disabled', this.data.atEnd);
                });
            }
        };

        e.data.leftNav.forEach((nl) => {
            nl.onclick = function () {
                e.move(-1);
            };
        });

        e.data.rightNav.forEach((nl) => {
            nl.onclick = function () {
                e.move(1);
            };
        });

        e.querySelectorAll('.card-carousel--card').forEach((crd, idx) => {
            crd.onclick = function (evt) {
                handleSdpiItemClick(crd, idx);
            };
        });
    });
};


function drag_start(event) {
    /**
     * In PI Samples the title-attribute is extracted to css and set
     * to an absolute position (at the bottom of the PI).
     * Since it is still part of the HTML-node, we just remove the title
     * attribute (otherwise the node will get extended so it includes the title
     * node too.)
     */
    // event.target.removeAttribute('title');
    event.target.removeAttribute('draggable');
    event.dataTransfer.effectAllowed = "all";
    var dataList = event.dataTransfer.items;
    /**
     * the following helper just formats the HTML, so the output
     * looks a bit nicer.
     */
    const prettifiedHTMLString = prettifyHTML(event.target.outerHTML);

    /**
     * Finally add the prettified string to the dragObjs data-container:
     */
    dataList.add(prettifiedHTMLString, "text/plain");

    } 


function dragTest() {
    const els = document.querySelectorAll('.sdpi-item');
    Array.from(els).forEach((e, i) => {
        //subel.style.display = obj.value.length ? 'flex' : 'none';
        e.addEventListener("dragstart", drag_start, false);
        e.setAttribute('draggable', "true");
        // e.ondragstart="drag_start(event)";
    });
    console.log("done");

}

function prettifyHTML(htmlStr) {
    const div = document.createElement('div');
    div.innerHTML = htmlStr.trim();
    return prettify(div, 0).innerHTML;
}

function prettify(node, level) {

    const spacesBefore = new Array(level++ + 1).join('  ');
    const spacesAfter  = new Array(level - 1).join('  ');
    let textNode;

    Object.values(node.children).map(e => {
        textNode = document.createTextNode('\n' + spacesBefore);
        node.insertBefore(textNode, e);
        prettify(e, level);
        if (node.lastElementChild == e) {
            textNode = document.createTextNode('\n' + spacesAfter);
            node.appendChild(textNode);
        }
    });

    return node;
}

function rangeToPercent(value, min, max) {
    return (value / (max - min));
};
function initToolTips() {
    console.log("INITTOOLTIPS")
    const tooltip = document.querySelector('.sdpi-info-label');
    const arrElements = document.querySelectorAll('.floating-tooltip');
    arrElements.forEach((e,i) => {
        console.log("ELEMENTS:", e);
        initToolTip(e, tooltip)
    })
}

function initToolTip(element, tooltip) {
    
    const tw = tooltip.getBoundingClientRect().width;
    const suffix = element.getAttribute('data-suffix') || '';

    const fn = () => {
      const elementRect = element.getBoundingClientRect();
      const w = elementRect.width - tw / 2;
      const percnt = rangeToPercent(element.value, element.min, element.max);
      tooltip.textContent = suffix != "" ? `${element.value} ${suffix}` : String(element.value);
      tooltip.style.left = `${elementRect.left + Math.round(w * percnt) - tw / 4}px`;
      tooltip.style.top = `${elementRect.top - 32}px`;
    };

    if (element) {
        element.addEventListener('mouseenter', function() {
            tooltip.classList.remove('hidden');
            tooltip.classList.add('shown');
            fn();
        }, false);

        element.addEventListener('mouseout', function() {
            tooltip.classList.remove('shown');
            tooltip.classList.add('hidden');
            fn();
        }, false);
        element.addEventListener('input', fn, false);
    }
}