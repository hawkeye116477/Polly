const currentDomain = window.location.hostname;

function handleResponse(message){
    enabledScripts = message.enabledScripts ? message.enabledScripts : [];

    enabledScripts.forEach((scriptName) => {
        const scriptElement = document.createElement('script');
        scriptElement.src = browser.runtime.getURL(scriptName);
        // scriptElement.onload = function () {
        //     this.remove();
        // };

        const parentElement = document.head || document.documentElement;
        parentElement.insertBefore(scriptElement, parentElement.firstChild);
    })
}
//
// browser.runtime.sendMessage({action: 'get', domain: currentDomain}).then(handleResponse, (error) => {
//     console.error(error);
// })


