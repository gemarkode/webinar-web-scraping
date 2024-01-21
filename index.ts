import { writeFileSync } from "fs";
import { chromium } from "playwright";

const $log = (...args: any[]) => console.log("[LOG]", ...args);

type ScrapeResult = Record<string, any>;

(async () => {
  const data: ScrapeResult[] = [];

  $log("Launching browser");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  $log("Navigating to page");
  await page.goto("https://www.lamudi.co.id/west-java/bandung/house/buy/");

  const listings = await page
    .locator("div.row.ListingCell-row.ListingCell-agent-redesign")
    .all();

  $log("Fetched", listings.length, "listings");

  for (const listing of listings) {
    const listingData: ScrapeResult = {};

    const a = listing.locator("a").first();
    const href = await a.getAttribute("href");

    $log("Navigating to", href);
    const page = await browser.newPage();
    await page.goto(href);

    $log("Getting title");
    const title = await page.locator("h1.Title-pdp-title").innerText();
    listingData["Judul"] = title;

    $log("Getting place");
    const place = await page.locator("h3.Title-pdp-address").innerText();
    listingData["Lokasi"] = place.trim();

    $log("Getting price");
    const price = await page.locator("div.Title-pdp-price").innerText();
    listingData["Harga"] = price;

    $log("Getting details");
    const detailsContainer = page.locator(
      "div.listing-section.listing-details"
    );
    const details = await detailsContainer.locator("div.columns-2").all();
    for (const detail of details) {
      const key = await detail.locator("div").first().innerText();
      const value = await detail.locator("div").last().innerText();
      listingData[key] = value;
    }

    $log("Getting images");
    const imageAnchor = page.locator("img.jsGalleryMainImage.loaded").first();
    await imageAnchor.click();

    const paginationText = await page
      .locator("span#js-viewerContainerGallerySwiperPaginator")
      .innerText();

    const totalImages = parseInt(paginationText.split(" ")[2]);
    $log("Total images:", totalImages);

    const nextButton = page.locator("button.splide__arrow.button-next").last();

    for (let i = 0; i < totalImages - 1; i++) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }

    const images = await page
      .locator("img.Header-pdp-inner-image.loading")
      .all();

    const imageUrls = await Promise.all(
      images.map(async (image) => await image.getAttribute("src"))
    );
    listingData["Gambar"] = imageUrls;

    $log("Images loaded:", imageUrls.length);

    $log("Closing modal");
    await page.locator("a#js-viewerContainerGalleryCloseBtn").click();

    $log("Getting contact");
    const requestContactButton = page.getByText("Tampilkan No. Telp").first();
    await requestContactButton.click();
    await page.waitForTimeout(1000);

    $log("Press ESC");
    await page.keyboard.press("Escape");

    const contactContainer = page
      .locator(
        "div.Agent-phoneNumber-mobile.AgentInfoV2-requestPhoneSection-phoneNumber.show"
      )
      .first();

    // check if contactContainer is visible
    const contactContainerVisible = await contactContainer.isVisible();
    if (contactContainerVisible) {
      const contact = await contactContainer.innerText();
      listingData["Kontak"] = contact.replace(/\D/g, "");
    } else {
      const contact = await page
        .locator(
          "div.AgentInfoV2-requestPhoneSection-phoneNumber.AgentInfoV2-requestPhoneSection-gradient"
        )
        .first()
        .innerText();
      listingData["Kontak"] = contact.replace(/\D/g, "") + "xxx";
    }

    await page.close();
    data.push(listingData);
  }

  $log("Writing to file");
  writeFileSync("data.json", JSON.stringify(data, null, 2));

  $log("Closing browser");
  await browser.close();

  $log("Press any key to exit");
  process.stdin.once("data", async () => {
    browser.close();
    process.exit(0);
  });
})();
