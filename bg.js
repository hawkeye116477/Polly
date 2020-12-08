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
                browser.storage.local.get([domain, 'requestDomains']).then((result) => {
                    const requestDomains = result['requestDomains'] ? result['requestDomains'] : [];
                    const isRequest = requestDomains.includes(domain);
                    const enabledScripts = result[domain] ? result[domain] : [];
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
            browser.storage.local.get('requestDomains').then((result) => {
                const requestDomains = result['requestDomains'] ? result['requestDomains'] : [];
                requestDomains.push(domain);
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
            return {};
        }
        if (enabledScripts.length === 0) {
            return {};
        }

        let filter = browser.webRequest.filterResponseData(details.requestId);

        let data = [];
        const requestKey = 'request' + details.requestId;

        filter.ondata = event => {
            browser.storage.local.get(requestKey).then((result) => {
                const encoding = result[requestKey];
                const decoder = new TextDecoder(encoding ? encoding : 'utf-8');
                data.push(decoder.decode(event.data, {stream: true}));
            }, (error) => {
                console.error(error);
            });
        };

        filter.onstop = () => {
            browser.storage.local.get(requestKey).then((result) => {
                const shouldProcess = !!result[requestKey];
                const encoding = shouldProcess ? result[requestKey].toLowerCase() : 'utf-8';

                const encoder = encoding === 'utf-8'
                    ? new TextEncoder()
                    : new TextEncoder2(encoding, {NONSTANDARD_allowLegacyEncoding: true});
                const decoder = new TextDecoder(encoding);
                data.push(decoder.decode());
                let documentText = data.join("");

                if (shouldProcess) {
                    let domparser = new DOMParser();
                    let document = domparser.parseFromString(documentText, 'text/html');
                    enabledScripts.forEach((script) => {
                        const scriptElement = document.createElement('script');
                        scriptElement.src = browser.runtime.getURL(script);

                        const parentElement = document.head || document.documentElement;
                        parentElement.insertBefore(scriptElement, parentElement.firstChild);
                    });
                    documentText = new XMLSerializer().serializeToString(document);
                }
                filter.write(encoder.encode(documentText));
                filter.disconnect();

            }, (error) => {
                console.error(error);
            });
        };
    }, (error) => {
        console.error(error);
    });
}

function onHeadersReceivedListener(details) {
    let encoding = "utf-8";
    const key = 'request' + details.requestId;
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
        })
        return {};
    }
    if (contentType.includes('arset=')) {
        encoding = contentType.split('arset=')[1];
    }

    obj[key] = encoding;
    browser.storage.local.set(obj).then(() => {
        return {};
    });
}

function registerRequestListeners() {
    if (browser.webRequest.onBeforeRequest.hasListener(onBeforeRequestListener)) {
        browser.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener);
    }
    if (browser.webRequest.onHeadersReceived.hasListener(onHeadersReceivedListener)) {
        browser.webRequest.onHeadersReceived.removeListener(onHeadersReceivedListener);
    }
    browser.storage.local.get('requestDomains').then((result) => {
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
