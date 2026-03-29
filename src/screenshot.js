//const nextFrame = () => new Promise(r => requestAnimationFrame(r))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const queryTileElements = () => document.querySelectorAll(".leaflet-tile-pane .leaflet-layer img.leaflet-tile")

const OUTPUT_RES_SCALE = 1.5 // increase canvas resolution

/** @param {"low" | "medium" | "high" | null | undefined} antialiasing */
const screenshotViewport = async (antialiasing = null) => {
    showAlert("Waiting for viewport to stabilize...")
    await waitForStableViewport() // wait until map is no longer being panned

    const tileElements = queryTileElements()
    if (!tileElements.length) throw new Error('No tiles found')

    /** @type {Array<HTMLImageElement>} */
    const tiles = []
    for (const img of tileElements) {
        if (!img.parentElement) continue

        const style = getComputedStyle(img.parentElement)
        const scale = parseFloat(style.transform.match(/scale\(([^)]+)\)/)?.[1] || '1')
        if (scale < 1) continue
        
        if (!img.complete) {
            try { await img.decode() } catch {}
        }
        
        tiles.push(img)
    }

    const canvas = new OffscreenCanvas(window.innerWidth * OUTPUT_RES_SCALE, window.innerHeight * OUTPUT_RES_SCALE)
    const ctx = canvas.getContext('2d', { alpha: false })

    ctx.imageSmoothingEnabled = !!antialiasing
    ctx.imageSmoothingQuality = antialiasing || 'low'
    ctx.scale(OUTPUT_RES_SCALE, OUTPUT_RES_SCALE) // scale the coords to draw correctly with increased res

    showAlert('Waiting for markers to load...')
    const overlayCanvasEl = document.querySelector('.leaflet-overlay-pane canvas.leaflet-zoom-animated')
    await waitForTransform(overlayCanvasEl)
    await delay(100)

    showAlert('Drawing layers...')
    await delay(100)

    await drawBackground(ctx)
    drawTiles(ctx, tiles)
    drawMarkers(ctx, overlayCanvasEl)

    return canvas
}

/** 
 * Draws the 'sky' background that is used to indicate an unplayble area past the world border.
 * In the case of missing tiles, this background will show up in their place as it lies underneath. 
 * @param {CanvasRenderingContext2D} ctx The canvas context on which to draw the background/sky on top.
 */
async function drawBackground(ctx) {
	const mapElement = document.querySelector('#map')
	if (!mapElement) return
	
	const bg = getComputedStyle(map).backgroundImage
	if (bg && bg !== 'none') {
		const img = new Image()
		img.crossOrigin = "anonymous"
		img.src = bg.slice(5, -2)
		
		await img.decode()

		ctx.fillStyle = ctx.createPattern(img, 'repeat')
		ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)
	}
}

/** 
 * Draws all tiles relative to the viewport, skipping any outside, onto the specified canvas given its context.
 * @param {CanvasRenderingContext2D} ctx The canvas context on which to draw the tiles on top.
 * @param {Array<HTMLImageElement>} tiles The array of tile image elements to be drawn.
 * @param {boolean} withFilter Whether to apply a CSS style `filter` to the tiles (decreased brightness etc).
 */
function drawTiles(ctx, tiles, withFilter = true) {
    if (withFilter) ctx.filter = getTilePaneFilter()
	for (const img of tiles) {
		const rect = img.getBoundingClientRect()

		// skip tiles fully outside viewport
		if (rect.right <= 0 || rect.bottom <= 0) continue
		if (rect.left >= ctx.canvas.width || rect.top >= ctx.canvas.height) continue

		ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)
	}
	ctx.filter = 'none'
}

/** 
 * Draws the overlay pane (including town markers) onto the specified canvas given its context.
 * @param {CanvasRenderingContext2D} ctx The canvas context on which to draw the markers on top.
 * @param {HTMLCanvasElement} overlay The canvas element of the overlay pane to draw onto. Errors if not provided.
 */
function drawMarkers(ctx, overlay = null) {
	if (!overlay) throw new Error('Cannot draw markers onto output image due to missing overlay pane element!')

	const rect = overlay.getBoundingClientRect()
	const x = Math.max(rect.left, 0)
	const y = Math.max(rect.top, 0)
	const width = Math.min(rect.right, ctx.canvas.width) - x
	const height = Math.min(rect.bottom, ctx.canvas.height) - y
	
	if (width > 0 && height > 0) {
		const scaleX = overlay.width / rect.width
		const scaleY = overlay.height / rect.height
		
		const dx = (x - rect.left) * scaleX
		const dy = (y - rect.top) * scaleY
		
		ctx.drawImage(overlay, dx, dy, width * scaleX, height * scaleY, x, y, width, height)
	}
}