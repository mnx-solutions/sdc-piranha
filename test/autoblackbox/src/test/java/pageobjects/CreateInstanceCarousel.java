package pageobjects;

import static com.codeborne.selenide.Condition.cssClass;
import static com.codeborne.selenide.Condition.hasClass;
import static com.codeborne.selenide.Condition.hasNotClass;
import static com.codeborne.selenide.Condition.hidden;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;

import com.codeborne.selenide.SelenideElement;

import data.CreateInstanceObject;

/**
 * "Create Instance" and its child pages page object. Holds methods to interact
 * with given pages.
 * 
 */
public class CreateInstanceCarousel {

	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "25000"));
	private static CreateInstanceCarousel createInstanceCarousel;

	public void waitUntilPageIsActive(int page) {
		$(".outer-provisioning-item", page).shouldHave(cssClass("active"));
	}

	public void selectDataCenter(String zone) {
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

	/**
	 * Method for getting the element from the carousel content listing
	 * 
	 * @param name
	 *            - text to filter the element by
	 * @return
	 */
	public SelenideElement getListElement(String name) {
		return Common.checkTextInCollection(
				$$(".active .item-scrolling .provisioning-item"), name);
	}

	public void waitForListingUpdate() {
		$(".provisioning-carousel-inner-box").waitUntil(
				hasNotClass("loading-medium"), BASE_TIMEOUT);
	}

	public void selectInstanceType(String type) {
		waitForListingUpdate();
		SelenideElement t = $(byAttribute("data-original-title",
				"Filter by instance type"));
		t.shouldBe(visible);
		t.$(byAttribute("data-toggle", "dropdown")).click();
		t.$(byText(type)).click();
	}

	public void selectPackage(String name) {
		waitForListingUpdate();
		SelenideElement el = getListElement(name);
		el.find(byAttribute("type", "radio")).click();
	}

	public void setOsVersion(String os, String version) {
		waitForListingUpdate();
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
		getListElement(os).find(byAttribute("type", "radio")).click();
	}

	public void checkSelectedImageDescription(String text) {
		$(".reconfigure-box").$(byText("Selected configuration")).shouldBe(
				visible);
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

	/**
	 * If instance with desired name exists, add a number at the end of the
	 * name.
	 * 
	 * @param name
	 *            desired name of the instance
	 * @return actual name of instance
	 */
	public String setInstanceNameValue(String name) {
		int i = 0;
		String n = name;
		do {
			if (i >= 1) {
				n = name + i;
				$(byAttribute("name", "machineName")).setValue(n);
			} else {
				$(byAttribute("name", "machineName")).setValue(n);
			}
			i++;
		} while ($(
				byAttribute("data-ng-show",
						"provisionForm.machineName.$error.machineUnique"))
				.isDisplayed());
		return n;
	}

	/**
	 * Confirm instance creation modal window.
	 */
	public void confirmInstanceCreation() {
		$(".modal").shouldBe(visible);
		$(".modal-header").shouldHave(text("Confirm: Create Instance"));
		$(".modal-footer").find(byText("OK")).click();
	}

	/**
	 * Cancel instance creation modal window.
	 */
	public void cancelInstanceCreation() {
		$(".modal").shouldBe(visible);
		$(".modal-header").shouldHave(text("Confirm: Create Instance"));
		$(".modal-footer").find(byText("Cancel")).click();
	}

	/**
	 * Provision a machine from a CreateInstanceObject.
	 * 
	 * @param CreateInstanceObject
	 * @return Image name
	 */
	public static String createIsntance(CreateInstanceObject i, String dc) {
		String instanceName = i.getInstanceName();
		String os = i.getImageOs();
		String version = i.getImageVersion();
		String packageSize = i.getPackageDisplayedName();
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.selectDataCenter(dc);
		createInstanceCarousel.waitUntilPageIsActive(0);
		createInstanceCarousel.setOsVersion(os, version);
		createInstanceCarousel.selectOsImage(os);
		createInstanceCarousel.waitUntilPageIsActive(1);
		createInstanceCarousel.selectPackage(packageSize);
		createInstanceCarousel
				.checkPaymentInfo(i.getPrice(), i.getPriceMonth());
		instanceName = createInstanceCarousel
				.setInstanceNameValue(instanceName);
		$(byText("Create instance")).click();
		createInstanceCarousel.confirmInstanceCreation();
		return instanceName;
	}
}
