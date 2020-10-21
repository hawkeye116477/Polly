const availableScripts = browser.runtime.getManifest().web_accessible_resources;
let enabledScripts = [];

browser.runtime.sendMessage({action: 'get'}).then((message) => {
    console.log(message)
    const element = document.createElement('div');
    const label = document.createElement('label');
    label.setAttribute('for', 'isRequest');
    label.innerText = 'Use request modification method for this domain';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'isRequest';
    input.name = 'isRequest';
    if (message.isRequest) {
        input.checked = true;
    }
    element.appendChild(label);
    element.appendChild(input)
    document.querySelector('main').appendChild(element);


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
        document.querySelector('main').appendChild(element);
    });
})

document.querySelector('body').addEventListener('change', (event) => {
    if (event.target.matches('input')) {
        if (event.target.matches('#isRequest')) {
            console.log('changing injection method');
            if (!event.target.checked) {
                console.log('remove');
                browser.runtime.sendMessage({action: 'removeFromRequest'}).then((result) => {
                }, (error) => {
                    console.error(error);
                });
            } else {
                console.log('add');
                browser.runtime.sendMessage({action: 'addToRequest'}).then((result) => {
                }, (error) => {
                    console.error(error);
                });

            }
            return;
        }
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


