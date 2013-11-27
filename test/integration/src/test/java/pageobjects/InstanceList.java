package pageobjects;

import static com.codeborne.selenide.Condition.disappear;
import static com.codeborne.selenide.Condition.hasText;
import static com.codeborne.selenide.Condition.hidden;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;

import com.codeborne.selenide.SelenideElement;

/**
 * Instance list page object. Holds methods to interact with given pages.
 * 
 */
public class InstanceList {
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));
	private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(System
			.getProperty("statustimeout", "240000"));

	/**
	 * Checks the state of a freshly created instance.
	 * 
	 * @param instance
	 *            - instance name
	 */
	public void checkForCreatedInstance(String instance) {
		waitForInstanceList();
		SelenideElement el = Common.checkTextInCollection(
				$$(".item-list-container .item"), instance);
		if (el.$(".machine-list-state").text().equals("Creating")) {
			el.$(".loading-small").shouldBe(hidden);
		}
		el = Common.checkTextInCollection($$(".item-list-container .item"),
				instance);
		el.$(".machine-list-state").shouldHave(text("Provisioning"));
	}

	public void checkInstanceStatus(String status, String instance) {
		$(".item-list-container").waitUntil(visible, BASE_TIMEOUT);
		SelenideElement el = Common.checkTextInCollection(
				$$(".item-list-container .item"), instance);
		if (el.find(".loading-small").isDisplayed()) {
			el.find(".loading-small").waitUntil(hidden, CHANGE_STATUS_TIMEOUT);
		}
		el = Common.checkTextInCollection($$(".item-list-container .item"),
				instance);
		el.find(".machine-list-state").waitUntil(hasText(status), BASE_TIMEOUT);
	}

	public void toggleInstanceControl(String instance) {
		$(".item-list-container").waitUntil(visible, BASE_TIMEOUT);
		SelenideElement e = Common.checkTextInCollection(
				$$(".item-list-container .item"), instance);
		$(e).waitUntil(visible, BASE_TIMEOUT);
		$(e).find(".status").waitUntil(visible, BASE_TIMEOUT);
		e.find(".status").click();
		if (e.find(".machine-details-info").isDisplayed()) {
			e.find(".machine-details-info").waitUntil(visible, BASE_TIMEOUT);
		}
		if (!e.find(".machine-details-info").isDisplayed()) {
			e.find(".machine-details-info").waitUntil(hidden, BASE_TIMEOUT);
		}
	}

	public void changeInstanceStatus(String operation, String instance) {
		$(".item-list-container").waitUntil(visible, BASE_TIMEOUT);
		SelenideElement e = Common.checkTextInCollection(
				$$(".item-list-container .row-fluid"), instance);
		e.find(byText(operation)).click();
		Common.confirmModal();
	}

	public void deleteInstance(String instance) {
		Common.checkTextInCollection($$(".item-list-container .item"), instance)
				.find(byText("Delete")).click();
		Common.confirmModal();
	}

	public String getFirtstInstanceName() {
		waitForInstanceList();
		String name = "";
		$(".item-list-container .item", 1).$(".machine-list-state").shouldBe(
				visible);
		$(".item-list-container .item", 1).$(".status").shouldBe(visible);
		name = $(".item-list-container .item", 1).$(
				"span.machine-list-content", 0).getText();
		return name;
	}

	public static void waitForInstanceList() {
		$(byText("Instances")).shouldBe(visible);
		$(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
	}

	public boolean isRunning(String instance) {
		SelenideElement el = Common.checkTextInCollection(
				$$(".item-list-container .item"), instance);
		if (el.$(".machine-list-state").text().equals("Running")) {
			return true;
		}
		return false;
	}
}
