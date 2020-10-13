function handleMessage(message, sender, sendResponse) {
    if (message.action === 'get') {
        if (message.domain) {
            console.log(message.domain);
            browser.storage.local.get(message.domain).then((result) => {
                const enabledScripts = result[message.domain] ? result[message.domain] : [];
                console.log(enabledScripts);
                sendResponse({enabledScripts: enabledScripts});
            });
        } else {
            browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
                const currentTab = tabs[0];
                const domain = currentTab.url.replace('http://', '').replace('https://', '').split(/[/?#]/)[0];
                console.log(domain);
                browser.storage.local.get(domain).then((result) => {
                    const enabledScripts = result[domain] ? result[domain] : [];
                    console.log(enabledScripts);
                    sendResponse({enabledScripts: enabledScripts});
                });
            }, console.error);
        }
    }
    if (message.action === 'set') {
        browser.tabs.query({currentWindow: true, active: true}).then((tabs) => {
            const currentTab = tabs[0];
            const domain = currentTab.url.replace('http://', '').replace('https://', '').split(/[/?#]/)[0];
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

