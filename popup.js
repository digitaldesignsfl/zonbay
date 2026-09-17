document.getElementById('extract').addEventListener('click', async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractAmazonData
  }, async (results) => {
    if (results && results[0]) {
      const productData = results[0].result;
      
      // SEND REFINED DATA TO YOUR NODE.JS API
      try {
        const response = await fetch('http://localhost:3000/api/save-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
        const apiResult = await response.json();
        alert(apiResult.message);
      } catch (error) {
        console.error("Error sending to API:", error);
        alert("Failed to send data to API. Is the server running?");
      }
    }
  });
});

function extractAmazonData() {
  // 1. Basic Info
  const title = document.getElementById('productTitle')?.innerText.trim();
  const price = document.querySelector('.a-price .a-offscreen')?.innerText.trim();
  
  // 2. Main Shareable Image Link
  const mainImgUrl = document.getElementById('landingImage')?.getAttribute('src') || 
                     document.getElementById('imgBlkFront')?.getAttribute('src');

  // 3. Collect Alternate Images from Gallery Thumbnails
  const alternateImages = [];
  const thumbnails = document.querySelectorAll('#altImages img, #imageBlock_feature_div img');
  thumbnails.forEach(img => {
    let src = img.getAttribute('src');
    if (src) {
      let hiResSrc = src.replace(/\._[A-Z0-9_]+_\./i, '.');
      if (!alternateImages.includes(hiResSrc) && !hiResSrc.includes('play-icon')) {
        alternateImages.push(hiResSrc);
      }
    }
  });

  // 4. "About this item" Feature Bullets
  const bulletPoints = [];
  const bulletElements = document.querySelectorAll('#feature-bullets ul li span.a-list-item');
  bulletElements.forEach(el => {
    const text = el.innerText.trim();
    if (text) bulletPoints.push(text);
  });

  // 5. Technical Details / Specifications Table
  const productSpecs = {};
  const specRows = document.querySelectorAll('.prodDetTable tr, #productDetails_techSpec_sections_1 tr');
  specRows.forEach(row => {
    const key = row.querySelector('th')?.innerText.trim();
    const value = row.querySelector('td')?.innerText.trim();
    if (key && value) {
      productSpecs[key] = value.replace(/\s+/g, ' ');
    }
  });

  // 6. Grab Long Product Description / Usage Details
  let longDescription = "";
  
  // Target the standard Amazon product description box
  const standardDescBlock = document.querySelector('#productDescription p span, #productDescription p');
  if (standardDescBlock) {
    longDescription = standardDescBlock.innerText.trim();
  }
  
  // Fallback 1: Book/Kindle description styles
  if (!longDescription) {
    const bookDescBlock = document.querySelector('#bookDescription_feature_div .a-expander-content, #editorialReviews_feature_div');
    if (bookDescBlock) {
      longDescription = bookDescBlock.innerText.trim();
    }
  }

  // Fallback 2: A+ Enhanced Content blocks (often where usage/infographics sit)
  if (!longDescription) {
    const apmDescBlock = document.querySelector('#aplus_feature_div, #aplus');
    if (apmDescBlock) {
      longDescription = apmDescBlock.innerText.replace(/\s+/g, ' ').trim();
    }
  }

  return { 
    title, 
    price, 
    mainImgUrl, 
    alternateImages: alternateImages.slice(0, 10),
    bulletPoints,
    productSpecs,
    longDescription
  };
}
