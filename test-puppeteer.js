/**
 * Simple Puppeteer test to validate installation
 */

const puppeteer = require('puppeteer');

/**
 * Compatibility helper for Puppeteer API changes
 */
async function waitFor(page, milliseconds) {
  try {
    if (typeof page.waitForDelay === 'function') {
      await page.waitForDelay(milliseconds);
    } else if (typeof page.waitForTimeout === 'function') {
      await page.waitForTimeout(milliseconds);
    } else {
      await new Promise(resolve => setTimeout(resolve, milliseconds));
    }
  } catch (error) {
    console.warn(`Wait function failed, using basic timeout: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}

async function testPuppeteer() {
  console.log('Testing Puppeteer installation...');
  
  try {
    console.log('Puppeteer version:', require('puppeteer/package.json').version);
    
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--window-size=1920x1080'
      ]
    });
    
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('✅ Page created successfully');
    
    // Test API compatibility
    console.log('Testing wait functions...');
    await waitFor(page, 100);
    console.log('✅ Wait function works correctly');
    
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    console.log('✅ Navigation successful');
    
    const title = await page.title();
    console.log(`✅ Page title: ${title}`);
    
    await browser.close();
    console.log('✅ Puppeteer test completed successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

if (require.main === module) {
  testPuppeteer()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testPuppeteer };
