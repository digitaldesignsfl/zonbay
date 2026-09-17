const axios = require('axios');
const fs = require('fs');

// Generates the massive XML structural block eBay requires to list a fresh item
function buildAddFixedPriceItemXml(packageData) {
    // Safety check to ensure arrays exist before running .map()
    const specificsXml = (packageData.itemSpecifics || []).map(spec => `
      <NameValueList>
        <Name>${escapeXml(spec.name)}</Name>
        <Value>${escapeXml(spec.value)}</Value>
      </NameValueList>`).join('');

    const picturesXml = (packageData.imageUrls || []).map(url => `
      <PictureURL>${url}</PictureURL>`).join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>__EBAY_AUTH_TOKEN_PLACEHOLDER__</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <!-- Core Details -->
    <Title>${escapeXml(packageData.title || '')}</Title>
    <Description><![CDATA[${packageData.htmlDescription || ''}]]></Description>
    <PrimaryCategory>
      <CategoryID>${packageData.categoryId || '172008'}</CategoryID>
    </PrimaryCategory>
    <StartPrice>${packageData.price || '0.00'}</StartPrice>
    <ConditionID>${packageData.conditionId || '1000'}</ConditionID>
    <Country>US</Country>
    <Currency>USD</Currency>
    <DispatchTimeMax>${packageData.shippingPolicy?.handlingTimeDays || 3}</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <Quantity>1</Quantity>

    <!-- Hardcoded Business & Return Policies -->
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
    </ReturnPolicy>
    <ShippingDetails>
      <ShippingServiceOptions>
        <ShippingService>USPSGroundAdvantage</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
        <FreeShipping>true</FreeShipping>
      </ShippingServiceOptions>
    </ShippingDetails>

    <!-- Media Assets -->
    <PictureDetails>${picturesXml}
    </PictureDetails>

    <!-- Technical Item Specifics -->
    <ItemSpecifics>${specificsXml}
    </ItemSpecifics>
  </Item>
</AddFixedPriceItemRequest>`;
}

function escapeXml(unsafeText) {
    return unsafeText.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'; 
            case '>': return '&gt;'; 
            case '&': return '&amp;'; 
            case '\'': return '&apos;'; 
            case '"': return '&quot;'; 
            default: return c;
        }
    });
}

async function publishNewListing() {
    // FIX: Read from the final data file containing the processed internet image links
    if (!fs.existsSync('ebay_final_api_ready.json')) {
        console.log("❌ Error: 'ebay_final_api_ready.json' is missing! Run your pipeline or dashboard sync first.");
        return;
    }

    const packageData = JSON.parse(fs.readFileSync('ebay_final_api_ready.json', 'utf8'));
    
    let authToken = "MOCK_TOKEN_PENDING_ACCOUNT_APPROVAL";
    if (fs.existsSync('ebay_tokens.json')) {
        const tokens = JSON.parse(fs.readFileSync('ebay_tokens.json', 'utf8'));
        authToken = tokens.accessToken;
    }

    const xmlPayload = buildAddFixedPriceItemXml(packageData).replace('__EBAY_AUTH_TOKEN_PLACEHOLDER__', authToken);
    
    console.log("\n🚀 Compiling official 'AddFixedPriceItem' XML Blueprint...");
    fs.writeFileSync('ebay_new_item_blueprint.xml', xmlPayload);
    console.log("Status: Success! Output generated at 'ebay_new_item_blueprint.xml'");
}

publishNewListing();
