function handleResponse(message) {
    console.log('injector received response');
    if (message.isRequest) {
        console.log('was handled by response handler');
        return;
    }
    console.log('injecting polyfills into document tree');
    enabledScripts = message.enabledScripts ? message.enabledScripts : [];
    console.log(enabledScripts);
    enabledScripts.forEach((scriptName) => {
        const scriptElement = document.createElement('script');
        scriptElement.src = browser.runtime.getURL(scriptName);

        const parentElement = document.head || document.documentElement;
        parentElement.insertBefore(scriptElement, parentElement.firstChild);
    })
}

console.log('running injector');
browser.runtime.sendMessage({action: 'get'}).then(handleResponse, (error) => {
    console.log(error);
    console.error(error);
})


