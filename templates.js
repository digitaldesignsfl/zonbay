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
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 960px; margin: 0 auto; color: #222; line-height: 1.6; background: #ffffff; border: 1px solid #e1e4e8; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">

  <!-- 1. HEADER PRODUCT SHOWCASE BANNER -->
  <div style="background: linear-gradient(135deg, #0d3b66 0%, #0046af 100%); color: #ffffff; padding: 30px 25px; text-align: center; border-bottom: 4px solid #f4d35e;">
    <div style="display: inline-block; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); border-radius: 20px; padding: 4px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
      ${brand} • ${specs['Condition'] || 'Brand New'}
    </div>
    <h1 style="margin: 0; font-size: 26px; line-height: 1.35; font-weight: 800; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
      ${title}
    </h1>
  </div>

  <div style="padding: 30px 25px;">

    <!-- 2. PRODUCT OVERVIEW & PRACTICAL USAGE -->
    <div style="margin-bottom: 35px;">
      <h2 style="font-size: 19px; color: #0d3b66; border-left: 4px solid #0046af; padding-left: 12px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        💡 Product Overview & Practical Usage
      </h2>
      <p style="font-size: 15px; color: #444; margin-bottom: 16px; line-height: 1.7;">
        ${aiCopy.usageIntro}
      </p>

      ${aiCopy.primaryUseCases.length > 0 ? `
      <div style="background: #f8faff; border: 1px solid #d9e6ff; border-radius: 8px; padding: 16px 20px; margin-top: 14px;">
        <strong style="color: #0046af; font-size: 14px; display: block; margin-bottom: 8px;">Key Applications & Benefits:</strong>
        <ul style="margin: 0; padding-left: 20px; color: #333; font-size: 14px;">
          ${aiCopy.primaryUseCases.map(u => `<li style="margin-bottom: 6px;">${u}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- 3. ITEM SPECIFICS & TECHNICAL REQUIREMENTS -->
    <div style="margin-bottom: 35px;">
      <h2 style="font-size: 19px; color: #0d3b66; border-left: 4px solid #0046af; padding-left: 12px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        ⚙️ Item Specifics & Technical Details
      </h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
        <tbody>
          ${specEntries.map(([k, v], idx) => {
            const bg = (idx % 2 === 0) ? '#fbfcfe' : '#ffffff';
            return `
            <tr style="background: ${bg}; border-bottom: 1px solid #edf2f7;">
              <td style="padding: 10px 14px; font-weight: 700; color: #334155; width: 35%; border-right: 1px solid #edf2f7;">${k}</td>
              <td style="padding: 10px 14px; color: #0f172a;">${v}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      ${aiCopy.technicalRequirements.length > 0 ? `
      <div style="margin-top: 16px; padding: 12px 16px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; font-size: 13px; color: #734a00;">
        <strong>Operational Requirements:</strong>
        <ul style="margin: 6px 0 0 0; padding-left: 20px;">
          ${aiCopy.technicalRequirements.map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- 4. WHAT'S IN THE BOX -->
    <div style="margin-bottom: 35px;">
      <h2 style="font-size: 19px; color: #0d3b66; border-left: 4px solid #0046af; padding-left: 12px; margin-top: 0; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
        📦 What's In The Box
      </h2>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #333;">
        ${aiCopy.includedItems.map(item => `<li style="margin-bottom: 6px; font-weight: 500;">${item}</li>`).join('')}
      </ul>
    </div>

  </div>

  <!-- 5. STORE SHOWCASE & CROSS-PROMOTION FOOTER AD -->
  <div style="background: #0f172a; color: #ffffff; padding: 25px; border-top: 3px solid #f4d35e;">
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 20px;">
      <div style="flex: 1; min-width: 250px;">
        <span style="background: #f4d35e; color: #0f172a; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Official Seller Store</span>
        <h3 style="margin: 8px 0 4px 0; font-size: 20px; color: #ffffff; font-weight: 700;">${storeName}</h3>
        <p style="margin: 0; font-size: 13px; color: #94a3b8;">${storeTagline}</p>
      </div>

      <div style="text-align: right;">
        <a href="${storeUrl}" target="_blank" style="display: inline-block; background: #0064d2; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 700; font-size: 14px; border: 1px solid rgba(255,255,255,0.2); transition: background 0.2s;">
          🏷️ Browse Full Store Inventory →
        </a>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 12px; color: #cbd5e1;">
      <div>🚀 <strong>Fast & Tracked Shipping:</strong> Dispatched promptly with complete tracking provided.</div>
      <div>⭐ <strong>100% Genuine Quality:</strong> Authentic merchandise inspected prior to packing.</div>
      <div>💬 <strong>Dedicated Support:</strong> Quick, friendly responses to all customer inquiries.</div>
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
<div style="font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 25px; color: #111; line-height: 1.6;">
  <h1 style="font-size: 24px; font-weight: 700; color: #111; margin-bottom: 12px; border-bottom: 2px solid #eee; padding-bottom: 12px;">${title}</h1>
  <p style="font-size: 15px; color: #444; margin-bottom: 24px;">${aiCopy.usageIntro}</p>

  <h3 style="font-size: 17px; margin-top: 24px; color: #222;">Key Specifications</h3>
  <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
    ${Object.entries(specs).slice(0, 12).map(([k, v], i) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 8px 0; font-weight: 600; width: 40%; color: #555;">${k}</td>
        <td style="padding: 8px 0; color: #111;">${v}</td>
      </tr>
    `).join('')}
  </table>

  <div style="margin-top: 30px; padding: 15px 20px; background: #f8f9fa; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
    <div><strong>${storeName}</strong> • Fast Dispatch & Tracked Delivery</div>
    <a href="${storeUrl}" target="_blank" style="color: #0064d2; text-decoration: none; font-weight: 600;">Visit Store →</a>
  </div>
</div>
`.trim();
    }

    /**
     * Master dispatcher: renders chosen template
     */
    function renderEbayTemplate(templateKey = 'storefront_showcase', product = {}, storeConfig = {}) {
        switch (templateKey) {
            case 'modern_minimalist':
                return renderModernMinimalist(product, storeConfig);
            case 'storefront_showcase':
            default:
                return renderStorefrontShowcase(product, storeConfig);
        }
    }

    return {
        renderEbayTemplate,
        renderStorefrontShowcase,
        renderModernMinimalist,
        generateAiRevisedCopy
    };
}));
