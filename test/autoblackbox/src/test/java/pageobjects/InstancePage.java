package pageobjects;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;

import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchElementException;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

/**
 * Instance details page object. Holds methods to interact with given pages.
 */
public class InstancePage {
    private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(System
            .getProperty("statustimeout", "240000"));

    public void validateStatus(String status) {
        $(".page-header .label").waitUntil(hasText(status),
                CHANGE_STATUS_TIMEOUT);
    }

    public void start() {
        $(byText("Start")).click();
        Common.clickButtonInModal("Yes");
    }

    public void stop() {
        $(byText("Stop")).click();
        Common.clickButtonInModal("Yes");
    }

    public void reboot() {
        $(byText("Reboot")).click();
        Common.clickButtonInModal("Yes");
    }

    public void delete() {
        $(byText("Delete")).click();
        Common.clickButtonInModal("Yes");
    }

    public static void rename(String name) {
        clickRenameInstanceIcon();
        getInstanceNameField().clear();
        getInstanceNameField().setValue(name);
        $("[data-ng-click=\"clickRename()\"]").click();
        Common.clickButtonInModal("Yes");
        $(".loading-medium.wait-rename").waitWhile(visible, timeout);
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
        Common.clickButtonInModal("Yes");
    }

    public void validateInstanceSize(String ram, String cpu, String disk) {
        $(byAttribute("data-ng-show", "currentPackage")).should(
                matchText("Memory: " + ram));
        $(byAttribute("data-ng-show", "currentPackage")).should(
                matchText("vCPUs: " + cpu));
        $(byAttribute("data-ng-show", "currentPackage")).should(
                matchText("Disk: " + disk));
    }

    public static void addTag(String key, String value) {
        SelenideElement tagSection = $("[data-collection-name=\"'tags'\"]");
        int lines = tagSection.$$("[data-ng-repeat=\"item in internalCollection\"]").size();
        SelenideElement row = $("[data-ng-repeat=\"item in internalCollection\"]", lines - 1);
        row.$("[placeholder=\"Key\"]").setValue(key);
        row.$("[placeholder=\"Value\"]").setValue(value);
        row.$("[data-ng-click=\"addItem()\"]").click();
        WaitForSmallSpinnerDisappear();
    }

    private static void WaitForSmallSpinnerDisappear() {
        $(".pull-right.loading-small").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
    }

    public static SelenideElement getTagContainerByKey(String key) {
        checkTagsVisible();
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
        checkTagsVisible();
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

    private static void checkTagsVisible() {
        $(byAttribute("data-ng-form", "tagForm")).shouldBe(visible);
    }

    public static void removeTag(String key) {
        $(byText(key)).$(By.xpath("..")).$("[data-ng-click=\"removeItem(item)\"]").click();
        WaitForSmallSpinnerDisappear();
    }

    public static void openTagsSection() {
        $("[data-ng-class=\"{active: accordionIcon[2] }\"]").click();
    }

    public static void openImagesSection() {
        $("[data-ng-class=\"{active: accordionIcon[4] }\"]").click();
    }

    public static boolean isTagDisplayed(String key, String value) {
        return $(By.xpath("//span[contains(.,'\"" + key + "\":\"" + value + "\')]")).isDisplayed();
    }

    public boolean validateIP(String ipRange) {
        SelenideElement div = $(byAttribute("data-ng-show", "machine.ips"));
        SelenideElement ips = div.find("span.value.span8.pull-right");
        for (SelenideElement ip : ips.findAll("span")) {
            if (ip.text().indexOf(ipRange) >= 0)
                return true;
        }
        return false;
    }

    public static void gotoInstanceDetails(String instanceName) {
        $(byText(instanceName)).click();
    }

    public static SelenideElement getInstanceNameField() {
        if (!$("#instanceRename").isDisplayed()) {
            return $(".page-title");
        }
        return $("#instanceRename");
    }

    public static void clickRenameInstanceIcon() {
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('.edit-text-icon').click()");
    }
}
