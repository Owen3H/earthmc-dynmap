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
