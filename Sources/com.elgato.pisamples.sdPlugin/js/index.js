/// <reference path="../libs/js/stream-deck.js" />
/// <reference path="../libs/js/action.js" />
/// <reference path="../libs/js/utils.js" />

/* GLOBALS */

const MCONTEXTS = [];
const MPLUGINDATA = {
    runningApps: []
};

/** ACTION  related */

const piSamplesAction = new Action('com.elgato.pisamples.action');
console.log('piSamplesAction', piSamplesAction);

piSamplesAction.onWillAppear(({context, payload}) => {
    console.log('onWillAppear', context, payload);
    if(!MCONTEXTS.includes(context)) MCONTEXTS.push(context);
    console.log('MCONTEXTS', MCONTEXTS);
});

piSamplesAction.onKeyDown(jsn => {
    console.log('onKeyDown', jsn.context);
});

piSamplesAction.onKeyUp(jsn => {
    console.log('onKeyUp', jsn.context);
});

piSamplesAction.onPropertyInspectorDidAppear(jsn => {
    console.log('onPropertyInspectorDidAppear', jsn.context);
    $SD.sendToPropertyInspector(jsn.context, {runningApps: MPLUGINDATA.runningApps});
});

piSamplesAction.onPropertyInspectorDidDisappear(jsn => {
    console.log('onPropertyInspectorDidDisappear', jsn.context);
});

piSamplesAction.onDidReceiveSettings(({context, payload}) => {
    console.log('onDidReceiveSettings', context, payload);
    const {key, value} = payload.settings;
    console.log('got settings', 'key', key, 'value', value);
});

const updatePanel = ((context, inData) => {
    console.log('updatePanel', context, inData);
    const payload = {
        'title': inData?.title,
        'value': {
            value: inData?.value,
        },
        icon: inData?.icon
    };
    $SD.setFeedback(context, payload);
});


// Here we receive the payload from the property inspector
piSamplesAction.onSendToPlugin(({context, payload}) => {
    console.log('onSendToPlugin', context, payload);
    if(payload && payload.hasOwnProperty('sdpi_collection')) {
        const {key, value} = payload.sdpi_collection;
        if(key === 'your_canvas') {
            updatePanel(context, {icon: value, title: 'canvas'});
            $SD.setImage(context, value);
        } else if(key === 'elgfilepicker') {
            if(value && typeof value === 'string' && ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'].some(e => value.endsWith(e))) {
                updatePanel(context, {icon: value, title: 'file'});
                $SD.setImage(context, value);
            } else {
                console.warn('Invalid image', value);
            }
        } else {
            updatePanel(context, {title: key, value: value});
            console.warn('Unknown key', key, 'with value', value);
        }
    }
});


/* STREAMDECK RELATED */

// In this example, we're monitoring a couple of apps
// that we've added to the manifest.json file
// under the "monitoredApps" key
// if one of the monitored apps is launched or terminated,
// we'll update the key images and send the running apps list
// to the property inspector

$SD.onApplicationDidLaunch((jsn) => {
    const {event, payload} = jsn;
    console.log('onApplicationDidLaunch', jsn, event, payload);
    // our monitored app settings (in manifest.json) are case-sensitive
    // so we need to capitalize the app name to match
    const app = Utils.capitalize(Utils.getApplicationName(payload));
    // there should be a corresponding image in the images folder
    const img = `images/${payload.application}.png`;
    // try to load it
    Utils.loadImagePromise(img).then(results => {
        MCONTEXTS.forEach(c => updateKeyImages(c, img, app, 'launched'));
    });
    // add the monitored app to our running apps list
    if(!MPLUGINDATA.runningApps.includes(app)) {MPLUGINDATA.runningApps.push(app);};
    // send the running apps list to the property inspector
    MCONTEXTS.forEach(updateRunningApps);
});

$SD.onApplicationDidTerminate(({context, payload}) => {
    console.log('onApplicationDidTerminate', payload, payload.application);
    // our monitored app settings (in manifest.json) are case-sensitive
    // so we need to capitalize the app name to match
    const app = Utils.capitalize(Utils.getApplicationName(payload));
    // remove the terminated app from our running apps list
    MPLUGINDATA.runningApps = MPLUGINDATA.runningApps.filter(item => item !== app);
    // there should be a corresponding image in the images folder
    const img = `images/${payload.application}.png`;
    // overlay our terminated image on top of the terminated app image
    const arrImages = [img, 'images/terminated.png'];
    // try to load them
    Utils.loadImages(arrImages).then(images => {
        // if successfully loaded, merge them
        Utils.mergeImages(images).then(b64 => {
            // and update the key images
            MCONTEXTS.forEach(c => updateKeyImages(c, b64, app, 'will end'));
            setTimeout(() => {
                // after 1.5 seconds, reset the key images
                MCONTEXTS.forEach(c => updateKeyImages(c, `images/default.svg`, app, 'quit'));
            }, 1500);
        });
    });
    // update the running apps list in the property inspector
    MCONTEXTS.forEach(updateRunningApps);
});

/** HELPERS */

const updateRunningApps = (context) => {
    console.log('updateRunningApps', MPLUGINDATA.runningApps);
    $SD.sendToPropertyInspector(context, {runningApps: MPLUGINDATA.runningApps});
};

const updateKeyImages = (context, icon, title = '', value = '') => {
    // console.log('updateKeyImages', context);
    updatePanel(context, {icon, title, value});
    $SD.setImage(context, icon);
};


/** UTILITIES USED IN THIS DEMO */

Utils.loadImagePromise = url =>
    new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({url, img, status: 'ok'});
        img.onerror = () => resolve({url, img, status: 'error'});
        img.src = url;
    });

Utils.loadImages = arrayOfUrls => Promise.all(arrayOfUrls.map(Utils.loadImagePromise));

Utils.capitalize = str => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

Utils.getApplicationName = (payload) => {
    const isMac = $SD.appInfo.application.platform === 'mac';
    if(payload && payload.application) {
        return isMac ? payload.application.split('.').pop() : payload.application.split('.')[0];
    }
    return '';
};

Utils.mergeImages = (images = [], options = {width: 144, height: 144, format: 'image/png', quality: 1}, inCanvas) => new Promise(resolve => {
    const canvas = inCanvas && inCanvas instanceof HTMLCanvasElement
        ? inCanvas
        : document.createElement('canvas');

    const ctx = canvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';

    resolve(Promise.all(images).then(images => {
        canvas.width = options.width || 144;
        canvas.height = options.height || 144;

        // Draw images to canvas
        images.forEach(image => {
            ctx.globalAlpha = image.opacity ? image.opacity : 1;
            return ctx.drawImage(image.img, image.x || 0, image.y || 0);
        });

        // Resolve all other data URIs sync
        return canvas.toDataURL(options.format, options.quality);
    }));
});
