package pageobjects;

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

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

import data.CreateInstanceObject;
import org.openqa.selenium.By;

/**
 * "Create Instance" and its child pages page object. Holds methods to interact
 * with given pages.
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
        SelenideElement dataCenterList = $(".provisioning-header-left-button");
        $("#button-select-datacenter").click();
        $(byText(zone)).click();
        $("#link-more-images").click();
    }

    public void selectOsFilter(String os) {
        waitForListingUpdate();
        SelenideElement t = $(byAttribute("data-original-title", "Filter by operating system"));
        $("#button-select-os").click();
        SelenideElement toClick = t.$("ul.dropdown-menu").$(byText(os));
        toClick.click();
    }

    /**
     * Method for getting the element from the carousel content listing
     *
     * @param name - text to filter the element by
     * @return
     */
    public SelenideElement getListElement(String name) {
        return Common.checkTextInCollection($$(".active .item-scrolling .provisioning-item"), name);
    }

    public void waitForListingUpdate() {
        $(".provisioning-carousel-inner-box").waitUntil(hasNotClass("loading-medium"), BASE_TIMEOUT);
    }

    public void selectInstanceType(String type) {
        waitForListingUpdate();
        SelenideElement t = $(byAttribute("data-original-title", "Filter by instance type"));
        t.shouldBe(visible);
        t.$(byAttribute("data-toggle", "dropdown")).click();
        t.$(byText(type)).click();
    }

    public void selectPackage(String name) {
        $(byText(name)).click();
    }

    public void setOsVersion(String os, String version) {
        waitForListingUpdate();
        SelenideElement t = Common.checkTextInCollection($$(".active .item-scrolling .provisioning-item"), os);
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

    public static void clickReviewBtn() {
        $("#button-review").click();
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
        ElementsCollection elements = $$(".selected-package-box-2 .package-info-desc");
        String[] texts = elements.getTexts();
        assertTrue(texts[0].equals(instancePackage));
        assertTrue(texts[1].equals(mem));
        assertTrue(texts[2].equals(disk));
        assertTrue(texts[3].equals(cpu));
        assertTrue(texts[4].equals(System.getProperty("datacenter")));
    }

    public void checkPaymentInfo(String h, String d) {
        String[] texts = $$(".dataset-cost h3").getTexts();
        assertTrue(texts[0].equals(h));
        assertTrue(texts[1].equals(d));
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
     * @param //CreateInstanceObject
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
        createInstanceCarousel.checkPaymentInfo(i.getPrice(), i.getPriceMonth());
        instanceName = createInstanceCarousel.setInstanceNameValue(instanceName);
        $(byText("Create instance")).click();
        createInstanceCarousel.confirmInstanceCreation();
        return instanceName;
    }
}
