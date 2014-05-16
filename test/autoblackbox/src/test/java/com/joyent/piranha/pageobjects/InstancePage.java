package com.joyent.piranha.pageobjects;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Condition.hasText;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

/**
 * Instance details page object. Holds methods to interact with given pages.
 */
public class InstancePage {
    private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(PropertyHolder.getChangeStatusTimeout());

    public void validateStatus(String status) {
        $(".page-header .label").waitUntil(hasText(status),
                CHANGE_STATUS_TIMEOUT);
    }

    public void stop() {
        $(byText("Stop")).click();
        Common.clickButtonInModal("Yes");
    }

    public void reboot() {
        $(byText("Reboot")).click();
        Common.clickButtonInModal("Yes");
    }

    @Deprecated
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

@Deprecated
    public void resize(String size) {
        Common.checkSubHeadingText("Resize Instance");
        $(byText("Resize Instance type")).shouldBe(visible);
        $(By.name("resize")).selectOptionByValue(size);
        $(byText("Resize")).click();
        Common.clickButtonInModal("Yes");
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

    @Deprecated
    public static SelenideElement getInstanceNameField() {
        if (!$("#instanceRename").isDisplayed()) {
            return $(".page-title");
        }
        return $("#instanceRename");
    }

    @Deprecated
    public static void clickRenameInstanceIcon() {
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('.edit-text-icon').click()");
    }
}
