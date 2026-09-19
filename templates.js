/**
 * Zonbay - Universal eBay Listing Template Engine & AI Revision Assistant
 * Dual-environment module: Works in Node.js and Browser.
 * Generates conversion-optimized, responsive eBay HTML descriptions.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ZonbayTemplates = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    /**
     * AI-powered / rule-based copy synthesizer for product usage and requirements
     */
    function generateAiRevisedCopy(product = {}) {
        const title = product.title || 'Quality Product';
        const brand = product.brand || 'Premium Quality';
        const bullets = Array.isArray(product.bulletPoints) ? product.bulletPoints : [];
        const specs = product.productSpecs || {};
        const rawDesc = product.longDescription || '';

        // Extract key usage concepts from title and bullets
        const titleLower = title.toLowerCase();
        let usageIntro = "";
        let primaryUseCases = [];
        let technicalRequirements = [];
        let includedItems = [];

        // Identify product category nuances for usage copy
        if (titleLower.includes('charger') || titleLower.includes('maintainer')) {
            usageIntro = `Engineered for effortless everyday maintenance, this ${brand} unit delivers reliable, automated power management to protect and extend battery life. Designed for plug-and-play simplicity, it automatically detects battery condition, adjusts charging levels, and enters safe float maintenance once full—eliminating any risk of overcharging or damage.`;
            primaryUseCases = [
                'Automotive & Powersports: Ideal for cars, motorcycles, ATVs, boats, and RVs stored seasonally or driven infrequently.',
                'Battery Longevity: Desulfates and maintains standard lead-acid, AGM, and gel cell batteries at optimal resting voltage.',
                'Weather-Resilient Operation: Built for garage, workshop, and outdoor maintenance applications.'
            ];
            technicalRequirements.push('Power Connection: Requires standard 100V–240V AC household outlet.');
            if (specs['Voltage']) technicalRequirements.push(`Operating Voltage: Designed for ${specs['Voltage']} battery systems.`);
            if (specs['Amperage']) technicalRequirements.push(`Output Rating: ${specs['Amperage']} regulated charging current.`);
        } else if (titleLower.includes('strip') || titleLower.includes('surge') || titleLower.includes('outlet')) {
            usageIntro = `Designed to streamline your workspace and shield high-value electronics from voltage spikes, this ${brand} surge protector expands standard wall outlets into a centralized, safe charging station. Built with multi-layer fire-retardant materials and high-joule energy absorption, it delivers steady power to computers, home theater setups, and mobile devices.`;
            primaryUseCases = [
                'Home Office & Gaming: Safely powers multiple desktop rigs, monitors, and gaming consoles.',
                'Entertainment Centers: Shields TVs, soundbars, and audio equipment from transient grid spikes.',
                'High-Speed Device Charging: Dedicated smart USB ports deliver rapid power delivery without bulky adapters.'
            ];
            technicalRequirements.push('Input Voltage: Standard 120V AC household circuit.');
            technicalRequirements.push('Surge Protection: Integrated circuit breaker with automatic reset.');
        } else if (titleLower.includes('drill') || titleLower.includes('driver')) {
            usageIntro = `Engineered for both demanding job sites and precision DIY home projects, this ${brand} cordless tool delivers exceptional torque and ergonomic balance. Designed with high-efficiency motor technology, it provides smooth variable-speed control across diverse materials including hardwoods, metal, and masonry.`;
            primaryUseCases = [
                'Fastening & Assembly: Quick driving into framing, cabinetry, drywall, and furniture.',
                'Heavy-Duty Drilling: Handles hole saws, spade bits, and twist drills with minimal stall.',
                'Compact Maneuverability: Lightweight ergonomic balance fits smoothly into tight, hard-to-reach spaces.'
            ];
            technicalRequirements.push('Power System: Compatible with standard lithium-ion battery packs.');
            technicalRequirements.push('Chuck Capacity: Standard keyless chuck for rapid single-handed bit changes.');
        } else {
            // General high-converting usage narrative
            usageIntro = `Crafted with dependable craftsmanship by ${brand}, this product is built to combine durability with everyday practical performance. Whether for professional applications or everyday home use, it provides consistent, trouble-free operation.`;
            if (bullets.length > 0) {
                primaryUseCases = bullets.slice(0, 3).map(b => b.replace(/^[\s•\-\*]+/, ''));
            }
        }

        // What's in the box detection
        if (specs['Included Components']) {
            includedItems = String(specs['Included Components']).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        } else {
            // Check description for "Package Includes"
            const boxMatch = rawDesc.match(/(?:Package Includes|Package Contents|What's in the Box)[:\s]*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
            if (boxMatch) {
                includedItems = boxMatch[1].split(/[\n•\-]+/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 80);
            }
        }
        if (includedItems.length === 0) {
            includedItems = [`1x ${title.substring(0, 50)}`, '1x User Guide / Quick Start Documentation'];
        }

        return {
            usageIntro,
            primaryUseCases,
            technicalRequirements,
            includedItems
        };
    }

    /**
     * Template 1: STOREFRONT SHOWCASE (The User's Preferred Layout)
     * - Top Product Showcase Title Banner
     * - Product Overview & Everyday Usage
     * - Item Specifics & Technical Requirements Grid
     * - What's In The Box
     * - Store Showcase & Cross-Promotion Footer Ad
     */
    function renderStorefrontShowcase(product = {}, storeConfig = {}) {
        const title = product.title || 'Quality Item';
        const brand = product.brand || 'Unbranded';
        const specs = product.productSpecs || {};
        const bullets = Array.isArray(product.bulletPoints) ? product.bulletPoints : [];
        const rawDesc = product.longDescription || '';

        const aiCopy = generateAiRevisedCopy(product);

        // Store configuration defaults
        const storeName = storeConfig.storeName || 'Our Official Store';
        const storeUrl = storeConfig.storeUrl || 'https://www.ebay.com/usr';
        const storeTagline = storeConfig.storeTagline || 'Trusted Seller • Fast Dispatch • 100% Quality Guaranteed';

        // Filter and sort specs (Tier 1 & Tier 2 first)
        const specEntries = Object.entries(specs).filter(([k, v]) => v && v !== 'Does Not Apply');

        let html = `
<!-- ZONBAY STOREFRONT SHOWCASE TEMPLATE -->
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 960px; margin: 0 auto; color: #1e293b; line-height: 1.65; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

  <!-- 1. HEADER PRODUCT SHOWCASE BANNER -->
  <div style="background: linear-gradient(135deg, #0b1f3a 0%, #153e75 55%, #1b4f93 100%); color: #ffffff; padding: 34px 28px; text-align: center; border-bottom: 4px solid #f4d35e; position: relative;">
    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.16); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.25); border-radius: 24px; padding: 5px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
      <span>⭐ ${brand}</span>
      <span style="opacity: 0.6;">•</span>
      <span>${specs['Condition'] || 'Brand New'}</span>
      <span style="opacity: 0.6;">•</span>
      <span>100% Authentic</span>
    </div>
    <h1 style="margin: 0; font-size: 26px; line-height: 1.35; font-weight: 800; color: #ffffff; text-shadow: 0 2px 6px rgba(0,0,0,0.25); letter-spacing: -0.2px;">
      ${title}
    </h1>
  </div>

  <div style="padding: 32px 28px;">

    <!-- 2. PRODUCT OVERVIEW & PRACTICAL USAGE -->
    <div style="margin-bottom: 36px;">
      <h2 style="font-size: 19px; color: #0f2744; border-left: 4px solid #0053a0; padding-left: 12px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
        <span>💡</span> Product Overview & Practical Usage
      </h2>
      <p style="font-size: 15px; color: #334155; margin-bottom: 18px; line-height: 1.75;">
        ${aiCopy.usageIntro}
      </p>

      ${aiCopy.primaryUseCases.length > 0 ? `
      <div style="background: linear-gradient(180deg, #f8faff 0%, #f0f5fc 100%); border: 1px solid #c9defc; border-radius: 10px; padding: 18px 22px; margin-top: 16px;">
        <strong style="color: #0046af; font-size: 14px; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
          <span>🎯</span> Key Applications &amp; Benefits:
        </strong>
        <ul style="margin: 0; padding-left: 20px; color: #1e293b; font-size: 14px; line-height: 1.7;">
          ${aiCopy.primaryUseCases.map(u => `<li style="margin-bottom: 8px;"><strong>✓</strong> ${u}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- 3. ITEM SPECIFICS & TECHNICAL DETAILS -->
    <div style="margin-bottom: 36px;">
      <h2 style="font-size: 19px; color: #0f2744; border-left: 4px solid #0053a0; padding-left: 12px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
        <span>⚙️</span> Item Specifics & Technical Details
      </h2>
      
      <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tbody>
            ${specEntries.map(([k, v], idx) => {
              const bg = (idx % 2 === 0) ? '#f8fafc' : '#ffffff';
              return `
              <tr style="background: ${bg}; border-bottom: 1px solid #edf2f7;">
                <td style="padding: 11px 16px; font-weight: 700; color: #475569; width: 35%; border-right: 1px solid #edf2f7;">${k}</td>
                <td style="padding: 11px 16px; color: #0f172a; font-weight: 500;">${v}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${aiCopy.technicalRequirements.length > 0 ? `
      <div style="margin-top: 16px; padding: 14px 18px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #92400e;">
        <strong style="display: flex; align-items: center; gap: 6px;"><span>⚡</span> Operational Requirements:</strong>
        <ul style="margin: 6px 0 0 0; padding-left: 20px;">
          ${aiCopy.technicalRequirements.map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- 4. WHAT'S IN THE BOX -->
    <div style="margin-bottom: 36px;">
      <h2 style="font-size: 19px; color: #0f2744; border-left: 4px solid #0053a0; padding-left: 12px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; display: flex; align-items: center; gap: 8px;">
        <span>📦</span> What's In The Box
      </h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
        ${aiCopy.includedItems.map(item => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 14px; color: #1e293b; display: flex; align-items: center; gap: 8px; font-weight: 500;">
          <span style="color: #0053a0; font-size: 16px;">📦</span>
          <span>${item}</span>
        </div>
        `).join('')}
      </div>
    </div>

  </div>

  <!-- 5. STORE SHOWCASE & CROSS-PROMOTION FOOTER AD -->
  <div style="background: linear-gradient(180deg, #0d1726 0%, #080f1a 100%); color: #ffffff; padding: 28px 28px 22px 28px; border-top: 3px solid #f4d35e;">
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px;">
      <div style="flex: 1; min-width: 250px;">
        <span style="background: #f4d35e; color: #0f172a; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.75px; display: inline-block;">Official Seller Store</span>
        <h3 style="margin: 10px 0 4px 0; font-size: 21px; color: #ffffff; font-weight: 800; letter-spacing: -0.3px;">${storeName}</h3>
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">${storeTagline}</p>
      </div>

      <div style="text-align: right;">
        <a href="${storeUrl}" target="_blank" style="display: inline-block; background: #0064d2; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 4px 12px rgba(0,100,210,0.35); transition: transform 0.15s, background 0.15s;">
          🏷️ Browse Full Store Inventory →
        </a>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 12px; color: #cbd5e1;">
      <div style="display: flex; gap: 8px; align-items: flex-start;">
        <span style="font-size: 16px;">🚀</span>
        <div><strong>Fast &amp; Tracked Shipping:</strong> Dispatched promptly with complete tracking provided.</div>
      </div>
      <div style="display: flex; gap: 8px; align-items: flex-start;">
        <span style="font-size: 16px;">⭐</span>
        <div><strong>100% Genuine Quality:</strong> Authentic merchandise inspected prior to packing.</div>
      </div>
      <div style="display: flex; gap: 8px; align-items: flex-start;">
        <span style="font-size: 16px;">💬</span>
        <div><strong>Dedicated Support:</strong> Quick, friendly responses to all customer inquiries.</div>
      </div>
    </div>
  </div>

</div>
<!-- END ZONBAY STOREFRONT SHOWCASE -->
`;
        return html.trim();
    }

    /**
     * Template 2: MODERN MINIMALIST
     */
    function renderModernMinimalist(product = {}, storeConfig = {}) {
        const title = product.title || 'Product Details';
        const brand = product.brand || 'Unbranded';
        const specs = product.productSpecs || {};
        const aiCopy = generateAiRevisedCopy(product);
        const storeName = storeConfig.storeName || 'Official Store';
        const storeUrl = storeConfig.storeUrl || 'https://www.ebay.com/usr';

        return `
<!-- ZONBAY MODERN MINIMALIST TEMPLATE -->
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 880px; margin: 0 auto; padding: 34px 30px; color: #1e293b; line-height: 1.65; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
  <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
    <span style="font-size: 13px; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 1.2px;">⭐ ${brand}</span>
    <span style="font-size: 12px; color: #64748b; font-weight: 600;">${specs['Condition'] || 'Brand New'} • Verified Authentic</span>
  </div>
  <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.35; margin: 0 0 16px 0; letter-spacing: -0.2px;">${title}</h1>
  <p style="font-size: 15px; color: #475569; margin-bottom: 26px; line-height: 1.75;">${aiCopy.usageIntro}</p>

  <h3 style="font-size: 17px; font-weight: 800; margin: 24px 0 12px 0; color: #0f172a; border-left: 3px solid #0284c7; padding-left: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Key Specifications</h3>
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
    ${Object.entries(specs).slice(0, 14).map(([k, v], i) => `
      <tr style="border-bottom: 1px solid #f1f5f9; background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'};">
        <td style="padding: 10px 14px; font-weight: 600; width: 38%; color: #475569;">${k}</td>
        <td style="padding: 10px 14px; color: #0f172a; font-weight: 500;">${v}</td>
      </tr>
    `).join('')}
  </table>

  <div style="margin-top: 32px; padding: 18px 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;">
    <div>
      <strong style="color: #0f172a; font-size: 14px;">${storeName}</strong>
      <div style="font-size: 12px; color: #64748b;">Fast Tracked Dispatch • 100% Quality Inspected</div>
    </div>
    <a href="${storeUrl}" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 9px 20px; border-radius: 6px; font-size: 13px; font-weight: 700;">Visit Store Inventory →</a>
  </div>
</div>
`.trim();
    }

    /**
     * Template 3: TECHNICAL PRO (Engineered for Tools, Electronics & Industrial)
     */
    function renderTechnicalPro(product = {}, storeConfig = {}) {
        const title = product.title || 'Technical Equipment';
        const brand = product.brand || 'Unbranded';
        const specs = product.productSpecs || {};
        const aiCopy = generateAiRevisedCopy(product);
        const storeName = storeConfig.storeName || 'Official Technical Store';
        const storeUrl = storeConfig.storeUrl || 'https://www.ebay.com/usr';

        const specEntries = Object.entries(specs).filter(([k, v]) => v && v !== 'Does Not Apply');

        return `
<!-- ZONBAY TECHNICAL PRO TEMPLATE -->
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 960px; margin: 0 auto; color: #0f172a; line-height: 1.65; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
  <!-- Top Technical Banner -->
  <div style="background: #0f172a; color: #f8fafc; padding: 26px 28px; border-bottom: 4px solid #38bdf8;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
      <span style="background: #38bdf8; color: #0f172a; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.75px;">ENGINEERED SPECIFICATIONS</span>
      <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">BRAND: <strong>${brand}</strong> | CONDITION: <strong>${specs['Condition'] || 'BRAND NEW'}</strong></span>
    </div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.35; letter-spacing: -0.2px;">${title}</h1>
  </div>

  <div style="padding: 28px;">
    <!-- Practical Usage & Applications -->
    <div style="margin-bottom: 30px;">
      <h3 style="font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; border-left: 4px solid #0284c7; padding-left: 10px; margin: 0 0 12px 0;">Product Overview &amp; Deployment</h3>
      <p style="font-size: 15px; color: #334155; line-height: 1.7; margin-bottom: 14px;">${aiCopy.usageIntro}</p>
      
      ${aiCopy.primaryUseCases.length > 0 ? `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px;">
        <strong style="color: #0369a1; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">Recommended Applications:</strong>
        <ul style="margin: 0; padding-left: 18px; font-size: 13.5px; color: #1e293b;">
          ${aiCopy.primaryUseCases.map(u => `<li style="margin-bottom: 6px;">${u}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- Technical Specs Matrix -->
    <div style="margin-bottom: 30px;">
      <h3 style="font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; border-left: 4px solid #0284c7; padding-left: 10px; margin: 0 0 12px 0;">Technical Specifications Matrix</h3>
      <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tbody>
            ${specEntries.map(([k, v], idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-weight: 700; color: #475569; width: 35%; border-right: 1px solid #e2e8f0;">${k}</td>
              <td style="padding: 10px 14px; color: #0f172a; font-family: 'Consolas', monospace; font-size: 13px;">${v}</td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- What's In The Box -->
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; border-left: 4px solid #0284c7; padding-left: 10px; margin: 0 0 12px 0;">Package Inclusions</h3>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #334155;">
        ${aiCopy.includedItems.map(item => `<li style="margin-bottom: 6px; font-weight: 600;">${item}</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- Store Guarantee Banner -->
  <div style="background: #1e293b; color: #f8fafc; padding: 20px 28px; border-top: 2px solid #38bdf8; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
    <div>
      <div style="font-weight: 800; font-size: 15px; color: #ffffff;">${storeName}</div>
      <div style="font-size: 12px; color: #94a3b8;">Full Tracking Provided • Certified Quality Dispatch</div>
    </div>
    <a href="${storeUrl}" target="_blank" style="background: #0284c7; color: #ffffff; text-decoration: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 700;">View Store Catalog →</a>
  </div>
</div>
`.trim();
    }

    /**
     * Authentic 1:1 Live eBay Listing Buyer Page Mockup
     * Replicates the full eBay buyer experience:
     * - Top utility bar & 4-color eBay navigation
     * - Interactive hero photo viewer with clickable thumbnail switching
     * - Seller trust card (Store name, Top Rated Plus badge, feedback %)
     * - Condition & dynamic pricing
     * - Buy It Now, Add to cart, and Watchlist CTA buttons
     * - Dynamic delivery estimate range & shipping breakdown
     * - Official eBay Item Specifics grid
     * - Embedded seller description template
     */
    function renderEbayBuyerPageMockup(product = {}, compiledDescriptionHtml = '', storeConfig = {}, options = {}) {
        function esc(s) {
            return String(s || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        const title = product.title || 'Quality Item';
        const brand = product.brand || (product.productSpecs && product.productSpecs['Brand']) || 'Premium Quality';
        const priceVal = parseFloat(product.price || 0);
        const priceFormatted = !isNaN(priceVal) && priceVal > 0 ? priceVal.toFixed(2) : '24.99';
        const shippingCostVal = parseFloat(product.shippingCost || 0);
        const shippingService = product.shippingService || 'USPS Ground Advantage®';
        const location = product.location || 'United States';
        const condition = (product.conditionId === '1000' || !product.conditionId) ? 'Brand New' : (product.conditionId === '3000' ? 'Used' : 'Refurbished');

        const storeName = storeConfig.storeName || 'Our Official Store';
        const storeUrl = storeConfig.storeUrl || 'https://www.ebay.com/usr';

        // Extract and sort images
        let images = [];
        if (Array.isArray(product.imageList) && product.imageList.length > 0) {
            images = product.imageList
                .filter(img => !img.isExcluded)
                .sort((a, b) => (a.isHero ? -1 : (b.isHero ? 1 : 0)))
                .map(img => img.url || img.dataUrl || img.hostedUrl)
                .filter(Boolean);
        }
        if (images.length === 0 && Array.isArray(product.alternateImages) && product.alternateImages.length > 0) {
            images = product.alternateImages.filter(Boolean);
        }
        if (images.length === 0 && product.mainImgUrl) {
            images = [product.mainImgUrl];
        }
        if (images.length === 0) {
            images = ['https://via.placeholder.com/600x600?text=No+Photo+Available'];
        }
        const heroImgUrl = images[0];

        // Calculate dynamic delivery range based on handling time + transit time
        const handlingDays = parseInt(product.dispatchTimeMax !== undefined ? product.dispatchTimeMax : (product.shippingPolicy?.handlingTimeDays || 3), 10);
        const isOutsideUs = (shippingService && shippingService.includes('OutsideUS')) || 
                            (location && location.toLowerCase().includes('china')) || 
                            Boolean(product.isInternational);

        // Transit buffer: Outside US = 7-19 business days (or 11-35 for Economy); US domestic = 2-5 business days
        let transitMinDays = 2;
        let transitMaxDays = 5;
        if (isOutsideUs) {
            if (shippingService && shippingService.includes('Economy')) {
                transitMinDays = 11;
                transitMaxDays = 30;
            } else {
                transitMinDays = 7;
                transitMaxDays = 19;
            }
        }

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        const d1 = new Date(now.getTime() + (handlingDays + transitMinDays) * 24 * 60 * 60 * 1000);
        const d2 = new Date(now.getTime() + (handlingDays + transitMaxDays) * 24 * 60 * 60 * 1000);
        const deliveryRange = `${days[d1.getDay()]}, ${months[d1.getMonth()]} ${d1.getDate()} and ${days[d2.getDay()]}, ${months[d2.getMonth()]} ${d2.getDate()}`;

        // Specifics formatting (2 key-value pairs per row = 4 columns on desktop)
        const specs = { ...(product.productSpecs || {}) };
        if (!specs['Condition']) specs['Condition'] = condition;
        if (!specs['Brand']) specs['Brand'] = brand;
        const specEntries = Object.entries(specs).filter(([k, v]) => v && v !== 'Does Not Apply');

        let specRowsHtml = '';
        for (let i = 0; i < specEntries.length; i += 2) {
            const pair1 = specEntries[i];
            const pair2 = specEntries[i + 1];
            specRowsHtml += `
            <tr style="border-bottom: 1px solid #e0e0e0;">
              <td style="padding: 9px 14px; background: #f7f7f7; color: #555555; font-weight: 600; width: 22%; border-right: 1px solid #e0e0e0; font-size: 13px;">${esc(pair1[0])}</td>
              <td style="padding: 9px 14px; background: #ffffff; color: #191919; width: 28%; border-right: 1px solid #e0e0e0; font-size: 13px;">${esc(pair1[1])}</td>
              ${pair2 ? `
              <td style="padding: 9px 14px; background: #f7f7f7; color: #555555; font-weight: 600; width: 22%; border-right: 1px solid #e0e0e0; font-size: 13px;">${esc(pair2[0])}</td>
              <td style="padding: 9px 14px; background: #ffffff; color: #191919; width: 28%; font-size: 13px;">${esc(pair2[1])}</td>
              ` : `
              <td style="padding: 9px 14px; background: #f7f7f7; width: 22%; border-right: 1px solid #e0e0e0;"></td>
              <td style="padding: 9px 14px; background: #ffffff; width: 28%;"></td>
              `}
            </tr>`;
        }

        // Description fallback
        const descContent = compiledDescriptionHtml || renderStorefrontShowcase(product, storeConfig);

        return `
<!-- LIVE EBAY LISTING PAGE MOCKUP -->
<div class="ebay-live-page-mockup" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f7f7f7; color: #191919; width: 100%; line-height: 1.4; padding-bottom: 40px;">

  <!-- 1. EBAY TOP UTILITY BAR -->
  <div class="ebay-header-utility" style="background: #ffffff; border-bottom: 1px solid #e5e5e5; font-size: 12px; color: #707070; padding: 6px 24px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      Hi <strong style="color: #191919;">Shopper</strong>! (<span style="color: #0053a0; cursor: pointer; text-decoration: underline;">Sign in</span>) &nbsp;|&nbsp; 
      <span style="cursor: pointer;">Daily Deals</span> &nbsp;|&nbsp; 
      <span style="cursor: pointer;">Brand Outlet</span> &nbsp;|&nbsp; 
      <span style="cursor: pointer;">Help &amp; Contact</span>
    </div>
    <div style="display: flex; gap: 16px; align-items: center;">
      <span style="cursor: pointer;">Sell</span>
      <span style="cursor: pointer;">Watchlist ▾</span>
      <span style="cursor: pointer;">My eBay ▾</span>
      <span style="cursor: pointer; font-size: 14px;">🔔</span>
      <span style="cursor: pointer; font-size: 14px;">🛒</span>
    </div>
  </div>

  <!-- 2. MAIN EBAY SEARCH HEADER -->
  <div class="ebay-header-main" style="background: #ffffff; border-bottom: 1px solid #e5e5e5; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
    <div style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: -2px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; user-select: none;">
        <span style="color:#e53238">e</span><span style="color:#0064d2">b</span><span style="color:#f5af02">a</span><span style="color:#86b817">y</span>
      </span>
      <span style="font-size: 13px; color: #555555; cursor: pointer; font-weight: 500;">Shop by category ▾</span>
    </div>

    <div class="ebay-search-bar" style="flex: 1; max-width: 820px; display: flex; align-items: center; border: 2px solid #191919; border-radius: 24px; overflow: hidden; background: #ffffff; height: 42px;">
      <span style="padding-left: 14px; color: #707070; font-size: 14px;">🔍</span>
      <input type="text" value="${esc(title.substring(0, 45))}" placeholder="Search for anything" style="flex: 1; border: none; outline: none; padding: 0 10px; font-size: 14px;" readonly />
      <div style="font-size: 12px; color: #555; border-left: 1px solid #ddd; padding: 0 12px; height: 100%; display: flex; align-items: center; cursor: pointer; background: #fbfbfb;">All Categories ▾</div>
      <button type="button" style="background: #0053a0; color: #ffffff; border: none; height: 100%; padding: 0 24px; font-weight: 700; font-size: 14px; cursor: pointer;">Search</button>
    </div>

    <span style="font-size: 11px; color: #707070; cursor: pointer; flex-shrink: 0;">Advanced</span>
  </div>

  <!-- 3. BREADCRUMBS -->
  <div class="ebay-breadcrumbs" style="background: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 8px 24px; font-size: 12px; color: #707070; display: flex; align-items: center; gap: 8px;">
    <span style="color: #0053a0; cursor: pointer;">&lt; Back to search results</span>
    <span>|</span>
    <span>Listed in category:</span>
    <span style="color: #0053a0; cursor: pointer;">eBay Motors</span> &gt;
    <span style="color: #0053a0; cursor: pointer;">Parts &amp; Accessories</span> &gt;
    <span style="color: #191919; font-weight: 600;">${esc(title.substring(0, 35))}...</span>
  </div>

  <!-- 4. LISTING BODY -->
  <div style="max-width: 1200px; margin: 16px auto; padding: 0 16px;">

    <!-- Card 1: Main Product Hero (Gallery + Buy Box) -->
    <div class="ebay-hero-card" style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
      <div class="ebay-hero-grid" style="display: grid; grid-template-columns: 480px 1fr; gap: 36px; align-items: start;">

        <!-- Left: Photo Gallery -->
        <div class="ebay-gallery-col">
          <div style="position: relative; border: 1px solid #eaeaea; border-radius: 8px; background: #ffffff; height: 480px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img id="ebayLiveHeroImg" src="${esc(heroImgUrl)}" alt="${esc(title)}" style="max-width: 92%; max-height: 450px; object-fit: contain; transition: transform 0.2s;" />
            <div id="ebayLiveImgCounter" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.65); color: #ffffff; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px;">1 of ${images.length}</div>
            <div style="position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.92); border: 1px solid #ddd; color: #555; font-size: 11px; padding: 3px 10px; border-radius: 12px; display: flex; align-items: center; gap: 4px; pointer-events: none; white-space: nowrap;">🔍 Roll over image to zoom in</div>
          </div>

          <!-- Thumbnails Strip -->
          <div class="ebay-thumb-strip" style="display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 6px;">
            ${images.map((img, idx) => `
            <button type="button" class="ebay-preview-thumb-btn ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-img-url="${esc(img)}" style="width: 58px; height: 58px; border-radius: 4px; border: ${idx === 0 ? '2px solid #0053a0' : '1px solid #d0d0d0'}; background: #ffffff; padding: 2px; cursor: pointer; flex-shrink: 0; outline: none; transition: all 0.15s;">
              <img src="${esc(img)}" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
            </button>
            `).join('')}
          </div>
        </div>

        <!-- Right: Buy Box & Details -->
        <div class="ebay-details-col">
          <h1 style="font-size: 20px; line-height: 1.35; font-weight: 700; color: #191919; margin: 0 0 10px 0;">
            ${esc(title)}
          </h1>

          <!-- Seller Trust Card -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px 14px; background: #f8f9fa; border: 1px solid #edf2f7; border-radius: 6px; margin-bottom: 16px;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #191919; display: flex; align-items: center; gap: 6px;">
                <span style="color: #0053a0;">${esc(storeName)}</span>
                <span style="background: #0053a0; color: #fff; border-radius: 50%; font-size: 10px; width: 15px; height: 15px; display: inline-flex; align-items: center; justify-content: center;">✓</span>
                <span style="background: #eef4fc; color: #0053a0; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">Top Rated Plus</span>
              </div>
              <div style="font-size: 12px; color: #555; margin-top: 2px;">99.8% positive feedback • 1,482 items sold</div>
            </div>
            <div style="display: flex; gap: 8px; font-size: 12px;">
              <a href="${esc(storeUrl)}" target="_blank" style="color: #0053a0; font-weight: 600; text-decoration: none;">Visit store</a>
              <span style="color: #bbb;">|</span>
              <span style="color: #0053a0; cursor: pointer;">Contact seller</span>
            </div>
          </div>

          <!-- Condition -->
          <div style="display: flex; gap: 14px; font-size: 13px; margin-bottom: 14px; border-bottom: 1px solid #eee; padding-bottom: 12px;">
            <span style="color: #707070; width: 75px; flex-shrink: 0;">Condition:</span>
            <div>
              <strong style="color: #191919;">${esc(specs['Condition'] || 'Brand New')}</strong>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #707070;">A brand-new, unused, unopened, undamaged item in its original packaging (where packaging is applicable).</p>
            </div>
          </div>

          <!-- Price -->
          <div style="background: #fafafa; border: 1px solid #f0f0f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px;">
            <div style="display: flex; align-items: baseline; gap: 10px;">
              <span style="font-size: 13px; color: #707070;">Price:</span>
              <span style="font-size: 28px; font-weight: 800; color: #191919;">US $${priceFormatted}</span>
              <span style="background: #eaf5ea; color: #1a7f37; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">Buy It Now</span>
            </div>
            <div style="font-size: 12px; color: #d9381e; font-weight: 600; margin-top: 6px;">🔥 High demand: 8 people bought this in the last 24 hours</div>
          </div>

          <!-- CTA Buttons -->
          <div style="margin-bottom: 18px;">
            <button type="button" style="width: 100%; padding: 13px 20px; background: #0053a0; color: #ffffff; border: none; border-radius: 24px; font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 8px; box-shadow: 0 2px 6px rgba(0,83,160,0.25);">
              Buy It Now
            </button>
            <button type="button" style="width: 100%; padding: 12px 20px; background: #e8f2fc; color: #0053a0; border: 1px solid #0053a0; border-radius: 24px; font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 8px;">
              Add to cart
            </button>
            <button type="button" style="width: 100%; padding: 10px 20px; background: #ffffff; color: #191919; border: 1px solid #707070; border-radius: 24px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              🤍 Add to Watchlist
            </button>
          </div>

          <!-- Shipping, Returns & Guarantees -->
          <div style="border-top: 1px solid #eee; padding-top: 14px; font-size: 13px;">
            <div style="display: flex; gap: 12px; margin-bottom: 10px;">
              <span style="color: #707070; width: 75px; flex-shrink: 0;">Shipping:</span>
              <div>
                ${shippingCostVal === 0 ? '<strong style="color: #1a7f37;">FREE Standard Shipping</strong>' : '<strong>$' + shippingCostVal.toFixed(2) + ' Standard Shipping</strong>'} via ${esc(shippingService)}
                <div style="color: #707070; font-size: 12px; margin-top: 2px;">
                  Item location: <strong>${esc(location)}</strong> | Ships to: United States and many other countries
                  ${isOutsideUs ? '<span style="display:inline-block; margin-left:6px; background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-size:11px; padding:1px 6px; border-radius:3px; font-weight:600;">🌏 International Transit (7-19 days)</span>' : ''}
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 10px;">
              <span style="color: #707070; width: 75px; flex-shrink: 0;">Delivery:</span>
              <div>
                Estimated between <strong>${deliveryRange}</strong>
                ${isOutsideUs ? '<span style="font-size: 11.5px; color: #6b7280; display: block; margin-top: 2px;">Includes ' + handlingDays + ' business days handling time from overseas dispatch.</span>' : ''}
              </div>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 10px;">
              <span style="color: #707070; width: 75px; flex-shrink: 0;">Returns:</span>
              <div><strong>30 days returns</strong>. Buyer pays for return shipping.</div>
            </div>

            <div style="display: flex; gap: 12px; margin-bottom: 14px;">
              <span style="color: #707070; width: 75px; flex-shrink: 0;">Payments:</span>
              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <span style="background: #0053a0; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">VISA</span>
                <span style="background: #eb001b; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">Mastercard</span>
                <span style="background: #0079c1; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">Amex</span>
                <span style="background: #ff6000; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">Discover</span>
                <span style="background: #f5f5f5; color: #0079c1; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px; border: 1px solid #ddd;">PayPal</span>
                <span style="background: #000; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">Apple Pay</span>
                <span style="background: #4285f4; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 3px;">Google Pay</span>
              </div>
            </div>

            <!-- eBay Money Back Guarantee Banner -->
            <div style="background: #eef4fc; border: 1px solid #c9defc; border-radius: 6px; padding: 10px 14px; display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 24px;">🛡️</div>
              <div>
                <div style="font-weight: 700; color: #0053a0; font-size: 13px;">eBay Money Back Guarantee</div>
                <div style="font-size: 11px; color: #444;">Get the item you ordered or your money back. Covers purchase price and original shipping.</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Card 2: Official eBay Item Specifics Grid -->
    <div class="ebay-specs-card" style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
      <h2 style="font-size: 18px; font-weight: 700; color: #191919; margin: 0 0 16px 0;">Item specifics</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0; font-size: 13px;">
        <tbody>
          ${specRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Card 3: Rendered Description Template -->
    <div class="ebay-desc-card" style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid #0053a0; padding-bottom: 8px;">
        <h2 style="font-size: 18px; font-weight: 700; color: #191919; margin: 0;">Description from seller</h2>
        <span style="font-size: 11px; color: #707070;">Seller assumes all responsibility for this listing.</span>
      </div>
      <div class="ebay-rendered-template-container" style="padding: 10px 0;">
        ${descContent}
      </div>
    </div>

  </div>
</div>
`;
    }

    /**
     * Master dispatcher: renders chosen template
     */
    function renderEbayTemplate(templateKey = 'storefront_showcase', product = {}, storeConfig = {}) {
        switch (templateKey) {
            case 'modern_minimalist':
                return renderModernMinimalist(product, storeConfig);
            case 'technical_pro':
                return renderTechnicalPro(product, storeConfig);
            case 'storefront_showcase':
            default:
                return renderStorefrontShowcase(product, storeConfig);
        }
    }

    return {
        renderEbayTemplate,
        renderStorefrontShowcase,
        renderModernMinimalist,
        renderTechnicalPro,
        renderEbayBuyerPageMockup,
        generateAiRevisedCopy
    };
}));
