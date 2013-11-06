package pageobjects;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.*;
import static com.codeborne.selenide.Selenide.*;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import util.Common;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

public class InstancePage {
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));
	private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(System
			.getProperty("statustimeout", "240000"));

	public void validateStatus(String status) {
		$(".page-header .label").waitUntil(hasText(status),
				CHANGE_STATUS_TIMEOUT);
	}

	public void start() {
		$(byText("Start")).click();
		Common.confirmModal();
	}

	public void stop() {
		$(byText("Stop")).click();
		Common.confirmModal();
	}

	public void reboot() {
		$(byText("Reboot")).click();
		Common.confirmModal();
	}

	public void delete() {
		$(byText("Delete")).click();
		Common.confirmModal();
	}

	public void rename(String name) {
		SelenideElement c = $("h1.machine-name");
		c.click();
		c.shouldNotBe(visible);
		$(byAttribute("name", "instanceRename")).shouldBe(visible);
		$("#instanceRename").setValue(name);
		$(byAttribute("name", "instanceRename")).find(".icon-ok").click();
		Common.confirmModal();
		// validateStatus("Renaming");
		// c.waitUntil(visible, CHANGE_STATUS_TIMEOUT);
		// c.shouldHave(text(name));
	}

	public void validateInstanceSpecs(String type, String name, String img,
			String version, String dc) {
		SelenideElement c = $("fieldset").$(".span11");
		c.should(matchText("Type\n" + type));
		c.should(matchText("Instance name\n" + name));
		c.should(matchText("Image\n" + img));
		c.should(matchText("Image version\n" + version));
		c.should(matchText("Datacenter\n" + dc));
	}

	public void resize(String size) {
		Common.checkSubHeadingText("Resize Instance");
		$(byText("Resize Instance type")).shouldBe(visible);
		$(By.name("resize")).selectOptionByValue(size);
		$(byText("Resize")).click();
		Common.confirmModal();
		// $(byAttribute("data-ng-class", "labelForState(machine.state)")).$(
		// ".loading-small").waitUntil(disappears, CHANGE_STATUS_TIMEOUT);
	}

	public void validateInstanceSize(String ram, String cpu, String disk) {
		$(byAttribute("data-ng-show", "currentPackage")).should(
				matchText("Memory: " + ram));
		$(byAttribute("data-ng-show", "currentPackage")).should(
				matchText("vCPUs: " + cpu));
		$(byAttribute("data-ng-show", "currentPackage")).should(
				matchText("Disk: " + disk));
	}

	public void addTag(String key, String value) {
		taglistVisible();
		$(".tags", 1).waitUntil(visible, BASE_TIMEOUT);
		int index = $$(".tags").size() - 2; // get the insert tag row dom index
		SelenideElement row = $(".tags", index);
		row.shouldBe(visible);
		row.$(byAttribute("placeholder", "Key")).setValue(key);
		row.$(byAttribute("placeholder", "Value")).setValue(value);
	}

	public static SelenideElement getTagContainerByKey(String key) {
		taglistVisible();
		for (SelenideElement el : $$(".tags")) {
			ElementsCollection ec = el.$$("input");
			for (SelenideElement e : ec) {
				if (!e.getAttribute("value").isEmpty()
						&& e.getAttribute("value").equals(key)) {
					return el;
				}
			}
		}
		throw new NoSuchElementException("Such element doesn't exist");
	}

	public static int getTagContainerIndexByKey(String key) {
		int i = 0;
		taglistVisible();
		for (SelenideElement el : $$(".tags")) {
			ElementsCollection ec = el.$$("input");
			for (SelenideElement e : ec) {
				if (!e.getAttribute("value").isEmpty()
						&& e.getAttribute("value").equals(key)) {
					return i;
				}
			}
			i++;
		}
		throw new NoSuchElementException("No tag with key:" + key + " found!");
	}

	private static void taglistVisible() {
		Common.checkSubHeadingText("Resize Instance");
		$(By.name("tagForm")).shouldBe(visible);
	}

	public void removeTag(String key) {
		int i = getTagContainerIndexByKey(key);
		if ($(".tags", i).$("div.editable span.delete").isDisplayed()) {
			$(".tags", i).$(" div.editable span.delete").click();
		} else if ($(".tags", i).$("div.row-fluid span.delete").isDisplayed()) {
			$(".tags", i).$("div.row-fluid span.delete").click();
		} else {
			throw new NoSuchElementException("No tag with key:" + key
					+ " found!");
		}
	}

	public void saveInstance() {
		$(byText("Save")).click();
		$(byAttribute("data-ng-show", "tagsave")).waitUntil(hidden,
				CHANGE_STATUS_TIMEOUT);
	}

	public boolean hasTag(String key, String value) {
		try {
			int i = getTagContainerIndexByKey(key);
			if ($(".tags", i).$("div.row-fluid span.key").text().equals(key)
					&& $(".tags", i).$("div.row-fluid span.value").text()
							.equals(value)) {
				return true;
			}
			return false;
		} catch (NoSuchElementException e) {
			return false;
		}
	}

	public boolean validateIP(String dataCenter, String ipRange) {
		SelenideElement div = $(byAttribute("data-ng-show", "machine.ips"));
		SelenideElement ips = div.find("span.value.span8.pull-right");
		for (SelenideElement ip : ips.findAll("span")) {
			if (ip.text().indexOf(ipRange) >= 0)
				return true;
		}
		return false;
	}
}
