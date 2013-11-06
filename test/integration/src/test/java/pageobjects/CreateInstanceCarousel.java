package pageobjects;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;

import util.Common;

import com.codeborne.selenide.SelenideElement;

import data.CreateInstanceObject;

public class CreateInstanceCarousel {

	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "25000"));
	private static CreateInstanceCarousel createInstanceCarousel;

	public void waitUntilPageIsActive(int page) {
		$(".outer-provisioning-item", page).shouldHave(cssClass("active"));
	}

	public void selectZoneFilter(String zone) {
		waitForListingUpdate();
		SelenideElement t = $(byAttribute("data-original-title",
				"Filter by zone"));
		t.$(byAttribute("data-toggle", "dropdown")).click();
		SelenideElement toClick = t.find("ul.dropdown-menu").$(byText(zone));
		toClick.click();
	}

	public void selectOsFilter(String os) {
		waitForListingUpdate();
		SelenideElement t = $(byAttribute("data-original-title",
				"Filter by operating system"));
		t.$(byAttribute("data-toggle", "dropdown")).click();
		SelenideElement toClick = t.find("ul.dropdown-menu").$(byText(os));
		toClick.click();
	}

	public SelenideElement getListElement(String name) {
		return Common.checkTextInCollection(
				$$(".active .item-scrolling .provisioning-item"), name);
	}

	public void waitForListingUpdate() {
		$(".provisioning-carousel-inner-box").waitUntil(
				hasNotClass("loading-medium"), BASE_TIMEOUT);
	}

	public void waitForCarouselPageToLoad(int item) {
		$(".outer-provisioning-item", item).shouldBe(visible);
	}

	public void selectInstanceType(String type) {
		waitForListingUpdate();
		// waitForCarouselPageToLoad(1);
		SelenideElement t = $(byAttribute("data-original-title",
				"Filter by instance type"));
		t.shouldBe(visible);
		t.$(byAttribute("data-toggle", "dropdown")).click();
		t.$(byText(type)).click();
	}

	public void selectPackage(String type) {
		waitForListingUpdate();
		waitForCarouselPageToLoad(1);
		SelenideElement el = getListElement(type);
		el.find(byAttribute("type", "radio")).click();
	}

	public void selectOsVersion(String os, String version) {
		waitForListingUpdate();
		//waitForCarouselPageToLoad(0);
		SelenideElement t = Common.checkTextInCollection(
				$$(".active .item-scrolling .provisioning-item"), os);
		if (t.$(byText("Choose image version")).isDisplayed()) {
			t.$(byAttribute("data-toggle", "dropdown")).click();
			t.$(".btn-group.pull-left").getCssValue("display");
			t.$(".btn-group.pull-left").should(hasClass("open"));
			t.$("ul.dropdown-menu").shouldBe(visible);
			t.$("ul.dropdown-menu").$(byText(version)).shouldBe(visible);
			t.$("ul.dropdown-menu").$(byText(version)).click();
			t.$("ul.dropdown-menu").shouldBe(hidden);
		}
	}

	public void selectOsImage(String os) {
		waitForListingUpdate();
		// waitForCarouselPageToLoad(0);
		getListElement(os).find(byAttribute("type", "radio")).click();
	}

	public void checkSelectedImageText(String text) {
		$(byText("Selected configuration")).shouldBe(visible);
		$("#selected-image").should(text(text));
	}

	public void checkPackageInfo(String dc, String mem, String disk, String cpu) {
		$("#selected-size").should(matchText("Datacenter " + dc));
		$("#selected-size").should(matchText("Memory " + mem));
		$("#selected-size").should(matchText("Disk " + disk));
		$("#selected-size").should(matchText("vCPUs " + cpu));
	}

	public void checkPaymentInfo(String h, String d) {
		$(".price-container div", 0).should(matchText(h));
		$(".price-container div", 0).find("h5 span").shouldHave(
				text("Hourly $"));
		$(".price-container div", 1).should(matchText(d));
		$(".price-container div", 1).find("h5 span").shouldHave(
				text("Est. Monthly $"));
	}

	public String setInstanceNameValue(String name) {
		int i = 0;
		String n = name;
		do {
			i++;
			if (i >= 1) {
				n = name + i;
				$(byAttribute("name", "machineName")).setValue(n);
			} else {
				$(byAttribute("name", "machineName")).setValue(n);
			}
		} while ($(
				byAttribute("data-ng-show",
						"provisionForm.machineName.$error.machineUnique"))
				.isDisplayed());
		return n;
	}

	public void confirmInstanceCreation() {
		$(".modal").shouldBe(visible);
		$(".modal-header").shouldHave(text("Confirm: Create Instance"));
		$(".modal-footer").find(byText("OK")).click();
	}

	public void cancelInstanceCreation() {
		$(".modal").shouldBe(visible);
		$(".modal-header").shouldHave(text("Confirm: Create Instance"));
		$(".modal-footer").find(byText("Cancel")).click();
	}

	public static String createIsntance(CreateInstanceObject i) {
		String instanceName = i.getImageName();
		String os = i.getImageOs();
		String version = i.getImageVersion();
		String packageSize = i.getPackageDisplayedName();
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.waitUntilPageIsActive(0);
		createInstanceCarousel.selectOsVersion(os, version);
		createInstanceCarousel.selectOsImage(os);
		createInstanceCarousel.waitUntilPageIsActive(1);
		createInstanceCarousel.selectPackage(packageSize);
		createInstanceCarousel
				.checkPaymentInfo(i.getPrice(), i.getPriceMonth());
		instanceName = createInstanceCarousel.setInstanceNameValue(instanceName);
		$(byText("Create instance")).click();
		createInstanceCarousel.confirmInstanceCreation();
		return instanceName;
	}
}
