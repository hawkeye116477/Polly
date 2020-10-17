function getDomainFromAddress(address) {
    return address.replace('http://', '').replace('https://', '').split(/[/?#]/)[0];
}

function handleMessage(message, sender, sendResponse) {
    if (message.action === 'get') {
        if (message.domain) {
            browser.storage.local.get(message.domain).then((result) => {
                const enabledScripts = result[message.domain] ? result[message.domain] : [];
                sendResponse({enabledScripts: enabledScripts});
            });
        } else {
            browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
                const currentTab = tabs[0];
                const domain = getDomainFromAddress(currentTab.url);
                browser.storage.local.get(domain).then((result) => {
                    const enabledScripts = result[domain] ? result[domain] : [];
                    sendResponse({enabledScripts: enabledScripts});
                });
            }, console.error);
        }
    }
    if (message.action === 'set') {
        browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
            const currentTab = tabs[0];
            const domain = getDomainFromAddress(currentTab.url);
            const object = {};
            object[domain] = message.enabledScripts;
            browser.storage.local.set(object).then((result) => {
            }, (error) => {
                console.error(error);
            });
        });
    }
    return true;
}

browser.runtime.onMessage.addListener(handleMessage);

function listener(details) {
    const domain = getDomainFromAddress(details.url);
    browser.storage.local.get(domain).then((result) => {
        const enabledScripts = result[domain] ? result[domain] : [];
        if (!enabledScripts) {
            return;
        }

        let filter = browser.webRequest.filterResponseData(details.requestId);
        let decoder = new TextDecoder("utf-8");
        let encoder = new TextEncoder();

        filter.ondata = event => {
            let str = decoder.decode(event.data, {stream: true});

            enabledScripts.forEach((script) => {
                const scriptUrl = browser.runtime.getURL(script);
                str = str.replace('<head>', `<head><script src="${scriptUrl}"></script>`);
            })

            filter.write(encoder.encode(str));
            filter.disconnect();
        }

    });

    return {};
}

browser.webRequest.onBeforeRequest.addListener(
    listener,
    {urls: ["<all_urls>"], types: ["main_frame"]},
    ["blocking"]
);
