const availableScripts = browser.runtime.getManifest().web_accessible_resources;
let enabledScripts = [];

browser.runtime.sendMessage({action: 'get'}).then((message) => {
    enabledScripts = message.enabledScripts ? message.enabledScripts : [];
    availableScripts.forEach((script) => {
        const element = document.createElement('div');
        const label = document.createElement('label');
        label.setAttribute('for', script);
        label.innerText = script;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = script;
        input.name = script;
        if (enabledScripts.includes(script)) {
            input.checked = true;
        }
        element.appendChild(label);
        element.appendChild(input)
        document.querySelector('body').appendChild(element);
    });
})

document.querySelector('body').addEventListener('change', (event) => {
    if (event.target.matches('input')) {
        const scriptName = event.target.name;
        if (!event.target.checked) {
            const index = enabledScripts.indexOf(scriptName);
            enabledScripts.splice(index, 1);
        } else {
            enabledScripts.push(scriptName);
        }
        browser.runtime.sendMessage({action: 'set', enabledScripts: enabledScripts}).then((result) => {
        }, (error) => {
            console.error(error);
        });
    }
})


