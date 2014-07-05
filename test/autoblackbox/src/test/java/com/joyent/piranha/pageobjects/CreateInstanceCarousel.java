package com.joyent.piranha.pageobjects;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.vo.CreateInstanceObject;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Condition.cssClass;
import static com.codeborne.selenide.Condition.hasClass;
import static com.codeborne.selenide.Condition.hasNotClass;
import static com.codeborne.selenide.Condition.hidden;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

/**
 * "Create Instance" and its child pages page object. Holds methods to interact
 * with given pages.
 */
@Deprecated
public class CreateInstanceCarousel {

    private static final int BASE_TIMEOUT = Integer.parseInt(PropertyHolder.getGlobalTimeout());

    public void waitUntilPageIsActive(int page) {
        $(".outer-provisioning-item", page).shouldHave(cssClass("active"));
    }

    public void selectDataCenter(String zone) {
        if (!$(byText("Quick Start: Create Instance")).isDisplayed()) {
            waitForListingUpdate();
        }
        $("#button-select-datacenter").click();
        $(byText(zone)).click();
    }

    public void waitForListingUpdate() {
        $(".provisioning-carousel-inner-box").waitUntil(hasNotClass("loading-medium"), BASE_TIMEOUT);
    }

    public void selectPackage(String name) {
        $(byText(name)).click();
    }

    public void setOsVersion(String os, String version) {
        waitForListingUpdate();
        SelenideElement element = Common.getRowByText($$(".active .item-scrolling .provisioning-item"), os);
        if (element.$(byText("Choose image version")).isDisplayed()) {
            element.$(byAttribute("data-toggle", "dropdown")).click();
            element.$(".btn-group.pull-left").getCssValue("display");
            element.$(".btn-group.pull-left").should(hasClass("open"));
            element.$("ul.dropdown-menu").shouldBe(visible);
            element.$("ul.dropdown-menu").$(byText(version)).shouldBe(visible);
            element.$("ul.dropdown-menu").$(byText(version)).click();
            element.$("ul.dropdown-menu").shouldBe(hidden);
        }
    }

    public void selectOsImage(String os) {
        waitForListingUpdate();
        $(".advanced-instance-title").$(byText(os), 0).$(By.xpath("../..")).$(byText("Select")).click();
    }

    public void checkPaymentInfo(String h, String d) {
        String[] texts = $$(".dataset-cost h3").getTexts();
        assertTrue(texts[1].equals(h));
        assertTrue(texts[2].equals(d));
    }

    /**
     * If instance with desired name exists, add a number at the end of the
     * name.
     * @param name desired name of the instance
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
                        "provisionForm.machineName.$error.machineUnique")
        )
                .isDisplayed());
        return n;
    }

    /**
     * Confirm instance creation modal window.
     */
    public void confirmInstanceCreation() {
        $(".modal").shouldBe(visible);
        $(".modal-header").shouldHave(text("Confirm: Create Instance"));
        $(".modal-footer").find(byText("Yes")).click();
    }

    /**
     * Provision a machine from a CreateInstanceObject.
     *
     * @param i  CreateInstanceObject
     * @param dc DataCenter
     * @return Image name
     */
    public static String createInstance(CreateInstanceObject i, String dc) {
        String instanceName = i.getInstanceName();
        String os = i.getImageOs();
        String version = i.getImageVersion();
        String packageSize = i.getPackageDisplayedName();
        CreateInstanceCarousel createInstanceCarousel = page(CreateInstanceCarousel.class);
        createInstanceCarousel.selectDataCenter(dc);
        createInstanceCarousel.waitUntilPageIsActive(0);
        createInstanceCarousel.setOsVersion(os, version);
        createInstanceCarousel.selectOsImage(os);
        createInstanceCarousel.waitUntilPageIsActive(1);
        createInstanceCarousel.selectPackage(packageSize);
        createInstanceCarousel.checkPaymentInfo(i.getPrice(), i.getPriceMonth());
        instanceName = createInstanceCarousel.setInstanceNameValue(instanceName);
        $(byText("Create instance")).click();
        createInstanceCarousel.confirmInstanceCreation();
        return instanceName;
    }
}
