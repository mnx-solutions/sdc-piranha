package com.joyent.piranha.pageobject;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import com.joyent.piranha.vo.CreateInstanceObject;
import org.openqa.selenium.By;
import org.openqa.selenium.interactions.HasInputDevices;
import org.openqa.selenium.interactions.Mouse;

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
import static junit.framework.Assert.assertTrue;

/**
 * "Create Instance" and its child pages page object. Holds methods to interact
 * with given pages.
 */
public class CreateInstance extends AbstractPageObject {
    public static final String TITLE = "Quick Start: Create Instance";

    @Override
    String getTitle() {
        return TITLE;
    }

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

    public void selectOsFilter(String os) {
        waitForListingUpdate();
        SelenideElement dropList = $(byAttribute("data-original-title", "Filter by operating system"));
        $("#button-select-os").click();
        SelenideElement toClick = dropList.$("ul.dropdown-menu").$(byText(os));
        toClick.click();
    }


    public void waitForListingUpdate() {
        $(".provisioning-carousel-inner-box").waitUntil(hasNotClass("loading-medium"), baseTimeout);
    }

    public void selectInstanceType(String type) {
        waitForListingUpdate();
        SelenideElement dropList = $(byAttribute("data-original-title", "Filter by instance type"));
        dropList.shouldBe(visible);
        dropList.$(byAttribute("data-toggle", "dropdown")).click();
        dropList.$(byText(type)).click();
    }

    public void selectPackage(String name) {
        $("#packagesAccordion").$(byText(name)).click();
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

    public void clickReviewBtn() {
        $("#button-review").click();
    }

    public Zenbox clickReviewBtn(String isFakePackages) {
        clickReviewBtn();
        if (isFakePackages.equals("fakePackage")) {
            WebDriverRunner.getWebDriver().switchTo().frame("zenbox_body");
        }
        return page(Zenbox.class);
    }

    public void selectOsImage(String os) {
        waitForListingUpdate();
        $(".advanced-instance-title").$(byText(os), 0).$(By.xpath("../..")).$(byText("Select")).click();
    }

    public void checkSelectedImageDescription(String description) {
        String a = $(".dataset-desc", 1).getText();
        assertTrue(a.contains(description));
    }

    public void checkPackageInfo(String mem, String disk, String cpu, String instancePackage) {
        ElementsCollection elements = $$(".center .value");
        String[] texts = elements.getTexts();
        assertTrue(texts[0].equals(instancePackage));
        assertTrue(texts[1].equals(mem));
        assertTrue(texts[2].equals(disk));
        assertTrue(texts[3].equals(cpu));
        assertTrue(texts[4].equals(System.getProperty("datacenter")));
    }

    public void checkPaymentInfo(String h, String d) {
        String[] texts = $$(By.xpath("//div[@class='cost']/div[@class = 'dataset-cost']/h3")).getTexts();
        assertTrue(texts[0].equals(h));
        assertTrue(texts[1].equals(d));
    }

    public void selectNetwork(int networkNumber) {
        ElementsCollection networks = $$(".checker");
        SelenideElement network = networks.get(networkNumber);
        Mouse mouse = ((HasInputDevices) WebDriverRunner.getWebDriver()).getMouse();
        mouse.mouseMove(network.getCoordinates());
        network.click();
    }

    public void clickCreateInstanceButton() {
        $(".create-instance-btn-pos").click();
    }

    /**
     * If instance with desired name exists, add a number at the end of the
     * name.
     *
     * @param name desired name of the instance
     * @return actual name of instance
     */
    public String setInstanceNameValue(String name) {
        int i = 0;
        String n = name;
        do {
            if (i >= 1) {
                n = name + i;
            }
            $(byAttribute("name", "machineName")).setValue(n);
            i++;
        } while ($(byAttribute("data-ng-show", "provisionForm.machineName.$error.machineUnique")).isDisplayed());
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
     * Cancel instance creation modal window.
     */
    public void cancelInstanceCreation() {
        $("[data-focus-on=\"button\"]").shouldBe(visible);
        $(".modal-header").shouldHave(text("Confirm: Create Instance"));
        $(".modal-footer").find(byText("No")).click();
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
        CreateInstance createInstanceCarousel = page(CreateInstance.class);
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

    public void clickViewMoreImages() {
        $("#link-more-images").click();
    }

    public void filterPackages(String parameter, String value) {
        String dropDownButton = ".dropdown-toggle span";
        ElementsCollection dropList = $$(".filter-container .btn-group");
        dropList.get(0).$(dropDownButton).click();
        $(byText(parameter)).click();
        dropList.get(1).$(dropDownButton).click();
        $(byText(value)).click();
    }

    public void openSection(String sectionName) {
        $("#packagesAccordion").$(byText(sectionName)).click();
    }
}
