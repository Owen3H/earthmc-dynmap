const htmlCode = {
    // Used in content.js
    buttons: {
        locate: '<button class="sidebar-button" id="locate-button">Locate</button>',
        searchArchive: '<button class="sidebar-button" id="archive-button">Search archive</button>',
        options: '<button class="sidebar-button" id="options-button">Options</button>',
        switchMapMode: '<button class="sidebar-input" id="switch-map-mode">Switch map mode</button>'
    },
    options: {
        menu: '<div id="options-menu"></div>',
        option: '<div class="option"></div>',
        label: '<label for="{option}">{optionName}</label>',
        checkbox: '<input id="{option}" type="checkbox" name="{option}">'
    },
    sidebar: '<div class="leaflet-control-layers leaflet-control" id="sidebar"></div>',
    sidebarOption: '<div class="sidebar-option"></div>',
    locateInput: '<input class="sidebar-input" id="locate-input" placeholder="London">',
    locateSelect: '<select class="sidebar-button" id="locate-select"><option>Town</option><option>Nation</option><option>Resident</option></select>',
    archiveInput: `<input class="sidebar-input" id="archive-input" type="date" min="2022-05-01" max="${new Date().toLocaleDateString('en-ca')}">`,
    currentMapModeLabel: '<div class="sidebar-option" id="current-map-mode-label">Current map mode: {currentMapMode}</div>',
    alertBox: '<div id="alert"><p id="alert-message">{message}</p><br><button id="alert-close">OK</button></div>',

    // Used in main.js
    playerLookup: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup"></div>',
    partOfLabel: '<span id="part-of-label">Part of <b>{allianceList}</b></span>',
    residentClickable: '<span class="resident-clickable" onclick="lookupPlayer(\'{player}\')">{player}</span>',
    residentList: '<span class="resident-list">\t{list}</span>',
    scrollableResidentList: '<div class="resident-list" id="scrollable-list">\t{list}</div>',
    playerLookupLoading: '<div class="leaflet-control-layers leaflet-control left-container" id="player-lookup-loading">Loading...</button>',
    alertMsg: '<div class="message" id="alert"><p id="alert-message">{message}</p></div>'
}

/**
 * Shows an alert message in a box at the center of the screen.
 * @param {string} message 
 */
function showAlert(message) {
	if (document.querySelector('#alert') != null) document.querySelector('#alert').remove()
	document.body.insertAdjacentHTML('beforeend', htmlCode.alertBox.replace('{message}', message))
	document.querySelector('#alert-close').addEventListener('click', event => { event.target.parentElement.remove() })
}

/**
 * @param {HTMLElement} parent
 * @param {HTMLElement} element
 * @param {any} selector
 * @param {boolean} all
 */
function addElement(parent, element, selector, all = false) {
	parent.insertAdjacentHTML('beforeend', element)
	return (!all) ? parent.querySelector(selector) : parent.querySelectorAll(selector)
}

function waitForElement(selector) {
	return new Promise(resolve => {
		const selected = document.querySelector(selector)
		if (selected) return resolve(selected)

		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) {
				resolve(document.querySelector(selector))
				observer.disconnect()
			}
		})
		observer.observe(document.body, { childList: true, subtree: true })
	})
}