function getDomainFromAddress(address) {
    return address.replace('http://', '').replace('https://', '').split(/[/?#]/)[0];
}

function getCurrentDomain() {
    return new Promise((resolve) => {
        browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
            const currentTab = tabs[0];
            const domain = getDomainFromAddress(currentTab.url);
            resolve(domain);
        });
    });
}

function handleMessage(message, sender, sendResponse) {
    if (message.action === 'get') {
        getCurrentDomain().then((domain) => {
                console.log('getting scripts for domain: ' + domain);
                browser.storage.local.get([domain, 'requestDomains']).then((result) => {
                    const requestDomains = result['requestDomains'] ? result['requestDomains'] : [];
                    const isRequest = requestDomains.includes(domain);
                    const enabledScripts = result[domain] ? result[domain] : [];
                    console.log('sending response to get scripts request', {
                        enabledScripts: enabledScripts,
                        isRequest: isRequest
                    });
                    sendResponse({enabledScripts: enabledScripts, isRequest: isRequest});
                });
            }
        )
        return true;
    }
    if (message.action === 'set') {
        getCurrentDomain().then((domain) => {
            const object = {};
            object[domain] = message.enabledScripts;
            browser.storage.local.set(object).then(() => {
            }, (error) => {
                console.error(error);
            });
        })
    }

    if (message.action === 'addToRequest') {
        getCurrentDomain().then((domain) => {
            console.log('adding ' + domain);
            browser.storage.local.get('requestDomains').then((result) => {
                const requestDomains = result['requestDomains'] ? result['requestDomains'] : [];
                console.log(requestDomains);
                requestDomains.push(domain);
                console.log(requestDomains);
                const uniqueRequestDomains = [...new Set(requestDomains)];
                const object = {};
                object['requestDomains'] = uniqueRequestDomains;
                browser.storage.local.set(object).then(() => {
                    registerRequestListeners();
                }, (error) => {
                    console.error(error);
                });

            });
        });
    }

    if (message.action === 'removeFromRequest') {
        getCurrentDomain().then((domain) => {
            browser.storage.local.get('requestDomains').then((result) => {
                const requestDomains = result['requestDomains'] ? result['requestDomains'] : [];
                const index = requestDomains.indexOf(domain);
                requestDomains.splice(index, 1);

                const object = {};
                object['requestDomains'] = requestDomains;
                browser.storage.local.set(object).then(() => {
                    registerRequestListeners();
                }, (error) => {
                    console.error(error);
                });
            });
        });
    }
}

browser.runtime.onMessage.addListener(handleMessage);

function onBeforeRequestListener(details) {
    let domain = getDomainFromAddress(details.url);
    browser.storage.local.get(domain).then((result) => {
        let enabledScripts = result[domain];
        if (!Array.isArray(enabledScripts)) {
            console.log('no scripts set up for domain ' + domain + ', skipping');
            return {};
        }
        if (enabledScripts.length === 0) {
            console.log('no scripts set up for domain ' + domain + ', skipping');
            return {};
        }

        let filter = browser.webRequest.filterResponseData(details.requestId);

        let data = [];
        const key = 'request' + details.requestId;

        filter.ondata = event => {
            console.log('data received');
            browser.storage.local.get(key).then((result) => {
                console.log(result);
                const encoding = result[key];
                if (!encoding) {
                    console.log('not a html document, skipping');
                    filter.disconnect();
                    return;
                }
                console.log('creating decoder with encoding: ' + encoding);
                const decoder = new TextDecoder(encoding);
                console.log('processing data chunk');
                data.push(decoder.decode(event.data, {stream: true}));
            }, (error) => {
                console.log(error);
            });
        };

        filter.onstop = () => {
            browser.storage.local.get(key).then((result) => {
                console.log(result);
                const encoding = result[key];
                if (!encoding) {
                    console.log('not a html document, skipping');
                    filter.disconnect();
                    return;
                }
                console.log('creating decoder with encoding: ' + encoding);
                const decoder = new TextDecoder(encoding);
                const encoder = encoding.toLowerCase() === 'utf-8'
                    ? new TextEncoder()
                    : new TextEncoder(encoding, {NONSTANDARD_allowLegacyEncoding: true});
                console.log('processing final chunk');
                data.push(decoder.decode());

                let str = data.join("");
               // console.log(str);
                let domparser = new DOMParser();
                let document = domparser.parseFromString(str, 'text/html');

                enabledScripts.forEach((script) => {
                    const scriptElement = document.createElement('script');
                    scriptElement.src = browser.runtime.getURL(script);

                    const parentElement = document.head || document.documentElement;
                    parentElement.insertBefore(scriptElement, parentElement.firstChild);
                });
                let x = new XMLSerializer().serializeToString(document);
                filter.write(encoder.encode(x));
                filter.disconnect();
            }, (error) => {
                console.log(error);
            });
        };
    }, (error) => {
        console.log(error);
    });
}

function onHeadersReceivedListener(details) {
    console.log('headers');
    let encoding = "utf-8";
    const key = 'request' + details.requestId;
    console.log(key);
    const headers = details.responseHeaders;
    let contentType = '';
    let obj = {};
    headers.forEach((header) => {
        if (header.name.toLowerCase() === 'content-type') {
            contentType = header.value;
        }
    })
    if (!contentType.includes('text/html')) {
        obj[key] = false;
        browser.storage.local.set(obj).then(() => {
            console.log('not html');
        })
        return {};
    }
    if (contentType.includes('arset=')) {
        encoding = contentType.split('arset=')[1];
        console.log('website is served with different encoding, changing to: ' + encoding);
    }

    obj[key] = encoding;
    browser.storage.local.set(obj).then(() => {
        return {};
    });
}

function registerRequestListeners() {
    console.log('brginning register process');
    if (browser.webRequest.onBeforeRequest.hasListener(onBeforeRequestListener)) {
        console.log('unregistering first');
        browser.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener);
    }
    if (browser.webRequest.onHeadersReceived.hasListener(onHeadersReceivedListener)) {
        console.log('unregistering first');
        browser.webRequest.onHeadersReceived.removeListener(onHeadersReceivedListener);
    }
    browser.storage.local.get('requestDomains').then((result) => {
        console.log(result);
        const requestDomains = result['requestDomains'] ? result['requestDomains'] : [];
        if (!requestDomains) {
            return;
        }
        if (requestDomains.length === 0) {
            return;
        }
        const filter = requestDomains.map((domain) => {
            return '*://' + domain + '/*';
        })
        console.log((filter));

        browser.webRequest.onBeforeRequest.addListener(
            onBeforeRequestListener,
            {urls: filter, types: ["main_frame", "sub_frame"]},
            ["blocking"]
        );
        browser.webRequest.onHeadersReceived.addListener(
            onHeadersReceivedListener,
            {urls: filter, types: ["main_frame", "sub_frame"]},
            ["blocking", "responseHeaders"]
        );
    });
}

registerRequestListeners();
