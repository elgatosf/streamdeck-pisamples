/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/action.js" />
/// <reference path="../libs/js/utils.js" />

console.log('Property Inspector loaded', $PI);

// register a callback for the 'connected' event
// this is all you need to communicate with the plugin and the StreamDeck software
$PI.onConnected(jsn => {
    console.log('Property Inspector connected', jsn);
    initPropertyInspector();
    console.log(jsn.actionInfo.payload.settings);
    Object.entries(jsn.actionInfo.payload.settings).forEach(([key, value]) => {
        console.log('setting', key, value);
        const el = document.getElementById(key);
        if(el) {
            el.value = value;
        }
    });

    let actionUUID = $PI.actionInfo.action;
    // register a callback for the 'sendToPropertyInspector' event
    $PI.onSendToPropertyInspector(actionUUID, jsn => {
        console.log('onSendToPropertyInspector', jsn);
        sdpiCreateList(document.querySelector('#runningAppsContainer'), {
            id: 'runningAppsID',
            label: 'Running Apps',
            value: jsn.payload.runningApps,
            type: 'list',
            selectionType: 'no-select'
        });
    });
});


/**
this sample plugin activates all of its controls in code
so we need to wait for the DOM to be ready
and then we can initialize the controls
You can also simply add the controls to the HTML and then
use the 'sendToPlugin' callback to send the desired values to the plugin
example:
<div class="sdpi-item" id="your_password">
    <div class="sdpi-item-label">Password</div>
    <input type="password" id="mypassword" onchange() class="sdpi-item-value" value="" placeholder="Enter your password">
  </div>
*
To try that, simply remove the 'initPropertyInspector' call above (or put a comment in front of it) and
type something into the 'Name' field. You should see the 'changed' message in the console of the plugin.
*/


// this is called by the 'Name' input field
const changed = () => {
    console.log('changed', event, event.target, event.target.value);
    // the value of the input field is saved to settings
    $PI.setSettings({[event.target.id]: event.target.value});
    // the value of the input field is also sent to the plugin
    // which is not needed, because the plugin already received
    // the value via the 'setSettings' call
    // This is mostly used to send values to the plugin 
    // that are not saved in the settings
    $PI.sendToPlugin({key: event.target.id, value: event.target.value});
};

// this is called by some buttons in the HTML
const clicked = () => {
    console.log('clicked', event?.target?.id, event?.target?.value);
};


/** 
 * TABS
 * ----
 * 
 * This will make the tabs interactive:
 * - clicking on a tab will make it active
 * - clicking on a tab will show the corresponding content
 * - clicking on a tab will hide the content of all other tabs
 * - a tab must have the class "tab"
 * - a tab must have a data-target attribute that points to the id of the content
 * - the content must have the class "tab-content"
 * - the content must have an id that matches the data-target attribute of the tab
 * - the content must have a data-tab attribute that matches the data-target attribute of the tab
 *  <div class="tab selected" data-target="#tab1" title="Show some inputs">Inputs</div>
 *  <div class="tab" data-target="#tab2" title="Here's some text-areas">Text</div>
 * a complete tab-example can be found in the index.html
   <div type="tabs" class="sdpi-item">
      <div class="sdpi-item-label empty"></div>
      <div class="tabs">
        <div class="tab selected" data-target="#tab1" title="Show some inputs">Inputs</div>
        <div class="tab" data-target="#tab2" title="Here's some text-areas">Text</div>
      </div>
    </div>
    <hr class="tab-separator" />
 * You can use the code below to activate the tabs (`activateTabs` and `clickTab` are required)
 */

function activateTabs(activeTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    let activeTabEl = null;
    allTabs.forEach((el, i) => {
        el.onclick = () => clickTab(el);
        if(el.dataset?.target === activeTab) {
            activeTabEl = el;
        }
    });
    if(activeTabEl) {
        clickTab(activeTabEl);
    } else if(allTabs.length) {
        clickTab(allTabs[0]);
    }
}

function clickTab(clickedTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    allTabs.forEach((el, i) => el.classList.remove('selected'));
    clickedTab.classList.add('selected');
    activeTab = clickedTab.dataset?.target;
    allTabs.forEach((el, i) => {
        if(el.dataset.target) {
            const t = document.querySelector(el.dataset.target);
            if(t) {
                t.style.display = el == clickedTab ? 'block' : 'none';
            }
        }
    });
}

/**
 * DEMO
 * ----
 * 
 * This initializes all elements found in the PI and makes them
 * interactive. It will also send the values to the plugin.
 * 
 * */

function initPropertyInspector(initDelay) {
    prepareDOMElements(document);
    demoCanvas();
    /** expermimental carousel is not part of the DOM
     * so let the DOM get constructed first and then
     * inject the carousel */
    setTimeout(function() {
        initCarousel();
        initToolTips();
        dragTest();

    }, initDelay || 100);
}

// our method to pass values to the plugin
function sendValueToPlugin(value, param) {
    $PI.sendToPlugin({[param]: value});
}

/** CREATE INTERACTIVE HTML-DOM
 * where elements can be clicked or act on their 'change' event.
 * Messages are then processed using the 'handleSdpiItemChange' method below.
 */
function prepareDOMElements(baseElement) {
    const onchangeevt = 'onchange'; // 'oninput'; // change this, if you want interactive elements act on any change, or while they're modified

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
            if(inputGroup.length === 2) {
                const offs = inputGroup[0].tagName === 'INPUT' ? 1 : 0;
                inputGroup[offs].innerText = inputGroup[1 - offs].value;
                inputGroup[1 - offs]['oninput'] = function() {
                    inputGroup[offs].innerText = inputGroup[1 - offs].value;
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
                if(cloneEvt) cloneEvt();
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
        if(e.targets.length) {
            let fn = () => {
                for(let x of e.targets) {
                    x.textContent = maxl ? `${e.value.length}/${maxl}` : `${e.value.length}`;
                }
            };
            fn();
            e.onkeyup = fn;
        }
    });

    baseElement.querySelectorAll('[data-open-url]').forEach(e => {
        const value = e.getAttribute('data-open-url');
        if(value) {
            e.onclick = () => {
                let path;
                if(value.indexOf('http') !== 0) {
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

    if(['OL', 'UL', 'TABLE'].includes(e.tagName)) {
        return;
    }

    /** SPANS are used inside a control as 'labels'
     * If a SPAN element calls this function, it has a class of 'clickable' set and is thereby handled as
     * clickable label.
     */

    if(e.tagName === 'SPAN') {
        const inp = e.parentNode.querySelector('input');
        var tmpValue;

        // if there's no attribute set for the span, try to see, if there's a value in the textContent
        // and use it as value
        if(!e.hasAttribute('value')) {
            tmpValue = Number(e.textContent);
            if(typeof tmpValue === 'number' && tmpValue !== null) {
                e.setAttribute('value', 0 + tmpValue); // this is ugly, but setting a value of 0 on a span doesn't do anything
                e.value = tmpValue;
            }
        } else {
            tmpValue = Number(e.getAttribute('value'));
        }

        if(inp && tmpValue !== undefined) {
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

    if(isList) {
        const siv = e.closest('.sdpi-item-value');
        if(!siv.classList.contains('multi-select')) {
            for(let x of sdpiItemChildren) x.classList.remove('selected');
        }
        if(!siv.classList.contains('no-select')) {
            e.classList.toggle('selected');
        }
    }

    if(sdpiItemChildren.length && ['radio', 'checkbox'].includes(sdpiItemChildren[0].type)) {
        e.setAttribute('_value', e.checked); //'_value' has priority over .value
    }
    if(sdpiItemGroup && !sdpiItemChildren.length) {
        for(let x of ['input', 'meter', 'progress']) {
            sdpiItemChildren = sdpiItemGroup.querySelectorAll(x);
            if(sdpiItemChildren.length) break;
        }
    }

    if(e.selectedIndex !== undefined) {
        if(e.tagName === 'SELECT') {
            sdpiItemChildren.forEach((ec, i) => {
                selectedElements.push({[ec.id]: ec.value});
            });
        }
        idx = e.selectedIndex;
    } else {
        sdpiItemChildren.forEach((ec, i) => {
            if(ec.classList.contains('selected')) {
                selectedElements.push(ec.textContent);
            }
            if(ec === e) {
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
    if(e.type === 'file') {
        const info = sdpiItem.querySelector('.sdpi-file-info');
        if(info) {
            const s = returnValue.value.split('/').pop();
            info.textContent = s.length > 28
                ? s.substr(0, 10)
                + '...'
                + s.substr(s.length - 10, s.length)
                : s;
        }
    }

    sendValueToPlugin(returnValue, 'sdpi_collection');
}

function updateKeyForDemoCanvas(cnv) {
    sendValueToPlugin({
        key: 'your_canvas',
        value: cnv.toDataURL()
    }, 'sdpi_collection');
}

/** UTILITIES */
/** Helper function to construct a list of running apps
 * from a template string.
 * -> information about running apps is received from the plugin
 */

function sdpiCreateList(el, obj, cb) {
    if(el) {
        el.style.display = obj.value.length ? 'block' : 'none';
        Array.from(document.querySelectorAll(`.${el.id}`)).forEach((subel, i) => {
            subel.style.display = obj.value.length ? 'flex' : 'none';
        });
        if(obj.value.length) {
            el.innerHTML = `<div class="sdpi-item" ${obj.type ? `class="${obj.type}"` : ''} id="${obj.id || window.btoa(new Date().getTime().toString()).substr(0, 8)}">
            <div class="sdpi-item-label">${obj.label || ''}</div>
            <ul class="sdpi-item-value ${obj.selectionType ? obj.selectionType : ''}">
                    ${obj.value.map(e => `<li>${e}</li>`).join('')}
                </ul>
            </div>`;
            setTimeout(function() {
                prepareDOMElements(el);
                if(cb) cb();
            }, 10);
            return;
        }
    }
    if(cb) cb();
};

/** Quick utility to return a random color.
 * If the randomly generated string is less than 6 characters
 * pad it with '0'
 */
function randomColor(prefix) {
    return (prefix || '') + (((1 << 24) * Math.random()) | 0).toString(16).padStart(6, 0); // just a random color padded to 6 characters
}

/** CANVAS DEMO */

function demoCanvas() {
    const touchDevice = (('ontouchstart' in document.documentElement) && (navigator.platform != 'Win32'));
    const evtDown = touchDevice ? 'touchstart' : 'mousedown';
    const evtMove = touchDevice ? 'touchmove' : 'mousemove';
    const evtEnd = touchDevice ? 'touchend' : 'mouseup';
    const evtX = touchDevice ? 'pageX' : 'clientX';
    const evtY = touchDevice ? 'pageY' : 'clientY';

    const cnv = document.querySelector('canvas');
    if(!cnv) return;
    const ctx = cnv.getContext('2d');
    if(!ctx) return;
    function drawRandomCanvas() {
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

    const pos = {x: 0, y: 0};

    var el = document.querySelector('.sdpi-wrapper');
    cnv.addEventListener(evtDown, function(e) {
        if(e.shiftKey) {
            drawRandomCanvas();
            return;
        }
        pos.x = e[evtX] - cnv.offsetLeft + el.scrollLeft;
        pos.y = e[evtY] - cnv.offsetTop + el.scrollTop;
    });

    cnv.addEventListener(evtEnd, function(e) {
        e.target.value = cnv.toDataURL();
    });

    cnv.addEventListener(evtMove, function(e) {
        if(!touchDevice) {
            if(!e.altKey || e.buttons !== 1) return;
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

    // updateKeyForDemoCanvas(cnv, cnv);
}

/** EXPERIMENTAL CAROUSEL  */

function initCarousel() {
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

        e.end = function() {
            return e.data.currentOffset <= (e.data.scrollDistance * -1) * (e.data.numCards - e.data.visibleCards);
        };

        const cards = e.querySelector('.card-carousel-cards');

        e.move = function(direction) {
            if(direction === 1 && !this.data.atEnd) {
                this.data.currentOffset -= this.data.scrollDistance;
            } else if(direction === -1 && !this.data.atStart) {
                this.data.currentOffset += this.data.scrollDistance;
            }

            if(cards) {
                cards.setAttribute('style', `transform:translateX(${this.data.currentOffset}px)`);
                this.data.atStart = this.data.currentOffset === 0;
                this.data.atEnd = this.end();
                this.data.leftNav.forEach((ctl) => {
                    if(!this.data.atStart) ctl.removeAttribute('disabled');
                    else ctl.setAttribute('disabled', this.data.atStart);
                });
                this.data.rightNav.forEach((ctl) => {
                    if(!this.data.atEnd) ctl.removeAttribute('disabled');
                    else ctl.setAttribute('disabled', this.data.atEnd);
                });
            }
        };

        e.data.leftNav.forEach((nl) => {
            nl.onclick = function() {
                e.move(-1);
            };
        });

        e.data.rightNav.forEach((nl) => {
            nl.onclick = function() {
                e.move(1);
            };
        });

        e.querySelectorAll('.card-carousel--card').forEach((crd, idx) => {
            crd.onclick = function(evt) {
                handleSdpiItemChange(crd, idx);
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

    const t = event.target.getAttribute('title');
    // event.target.removeAttribute('title');
    // temporarily remove draggable attribute before copying
    event.target.removeAttribute('draggable');
    event.dataTransfer.effectAllowed = "all";
    var dataList = event.dataTransfer.items;
    /**
     * the following helper just formats the HTML, so the output
     * looks a bit nicer.
     */
    const prettifiedHTMLString = prettifyHTML(event.target.outerHTML);

    // add draggable attribute after copying
    event.target.setAttribute('draggable', "true");
    if(t) event.target.setAttribute('title', t);

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
}

function prettifyHTML(htmlStr) {
    const div = document.createElement('div');
    div.innerHTML = htmlStr.trim();
    return prettify(div, 0).innerHTML;
}

function prettify(node, level) {

    const spacesBefore = new Array(level++ + 1).join('  ');
    const spacesAfter = new Array(level - 1).join('  ');
    let textNode;

    Object.values(node.children).map(e => {
        textNode = document.createTextNode('\n' + spacesBefore);
        node.insertBefore(textNode, e);
        prettify(e, level);
        if(node.lastElementChild == e) {
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
    const tooltip = document.querySelector('.sdpi-info-label');
    const arrElements = document.querySelectorAll('.floating-tooltip');
    arrElements.forEach((e, i) => {
        initToolTip(e, tooltip);
    });
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

    if(element) {
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


activateTabs();
