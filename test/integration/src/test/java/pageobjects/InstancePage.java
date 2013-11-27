package pageobjects;

import static com.codeborne.selenide.Condition.hasText;
import static com.codeborne.selenide.Condition.hidden;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

/**
 * Instance details page object. Holds methods to interact with given pages.
 * 
 */
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
	}

	public void validateInstanceSpecs(String type, String name, String img,
			String version, String memory, String disk, String ip,
			String created, String dc, String login) {
		SelenideElement c = $("fieldset").$(".span11");
		c.should(matchText("UUID\n"));
		c.should(matchText("Instance name\n" + name));
		c.should(matchText("Type\n" + type));
		c.should(matchText("Image\n" + img));
		c.should(matchText("Image version\n" + version));
		c.should(matchText("Memory\n" + memory));
		c.should(matchText("Disk\n" + disk));
		c.should(matchText("IP addresses\n" + ip));
		c.should(matchText("Created\n" + created));
		c.should(matchText("Datacenter\n" + dc));
		c.should(matchText("Login\n" + login));
	}

	public void resize(String size) {
		Common.checkSubHeadingText("Resize Instance");
		$(byText("Resize Instance type")).shouldBe(visible);
		$(By.name("resize")).selectOptionByValue(size);
		$(byText("Resize")).click();
		Common.confirmModal();
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
		$(".tag", 1).waitUntil(visible, BASE_TIMEOUT);
		int index = $$(".tag").size() - 2; // get the insert tag row dom index
		SelenideElement row = $(".tag", index);
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
		$(byAttribute("data-ng-form", "tagForm")).shouldBe(visible);
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
