package com.joyent.piranha.pageobject;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.PropertyHolder;
import org.openqa.selenium.By;
import org.openqa.selenium.interactions.HasInputDevices;
import org.openqa.selenium.interactions.Mouse;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static com.thoughtworks.selenium.SeleneseTestBase.assertTrue;

/**
 * "Create Instance" and its child pages page object. Holds methods to interact
 * with given pages.
 */
public class CreateInstanceManual extends AbstractPageObject implements CreateInstance {
    public static final String TITLE = "Create Instance";

    @Override
    String getTitle() {
        return TITLE;
    }

    public void waitUntilPageIsActive(int page) {
        $(".outer-provisioning-item", page).shouldHave(cssClass("active"));
    }

    public void selectDataCenter(String zone) {
        if (!$(byText("Quick Start: Create Instance")).isDisplayed()) {
            waitForMediumSpinnerDisappear();
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

    public void selectPackage(String name) {
        $("#packagesAccordion").$(byText(name)).click();
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

    public void chooseImage(String imageName) {
        waitForMediumSpinnerDisappear();
        $(By.xpath("//div[@class=\"advanced-instance-title\" and contains(.,'" + imageName + "')]")).click();
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
        assertTrue(texts[4].equals(PropertyHolder.getDatacenter(0)));
    }

    public void checkPaymentInfo(String h, String d) {
        String[] texts = $$(By.xpath("//div[@class='cost']/div[@class = 'dataset-cost']/h3")).getTexts();
        assertTrue(texts[0].equals(h));
        assertTrue(texts[1].equals(d));
    }

    public void selectNetwork(int networkNumber) {
        ElementsCollection networks = $$(".checker");
        networks.get(0).waitUntil(visible, baseTimeout);
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
     * Cancel instance creation modal window.
     */
    public void cancelInstanceCreation() {
        $("[data-focus-on=\"button\"]").shouldBe(visible);
        $(".modal-header").shouldHave(text("Confirm: Create Instance"));
        $(".modal-footer").find(byText("No")).click();
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

    public CreateInstanceManual clickAllPublicImagesLink() {
        $(byText("All Public Images")).click();
        return page(CreateInstanceManual.class);
    }

    public CreateInstanceQuickStart clickQuickLink() {
        $(By.xpath("//a[contains(text(),'Quick')]")).click();
        return page(CreateInstanceQuickStart.class);
    }

    @Override
    public Instances createInstance(InstanceVO instanceVO) {
        while ($$(".checker").size() == 0) {
            page(SideBarMenu.class).clickDashboard().clickCreateComputeInstance();
            clickAllPublicImagesLink();
            selectDataCenter(instanceVO.getDatacenter());
            chooseImage(instanceVO.getImageName());
            selectPackage(instanceVO.getPackageVersion());
            selectPackageVersion(instanceVO.getVersion());
            clickReviewBtn();
            sleep(1000);
        }
        selectNetwork(0);
        setInstanceNameValue(instanceVO.getImageName());
        clickCreateInstanceButton();
        clickButtonInModal("Yes");
        return page(Instances.class);
    }

    private void selectPackageVersion(String version) {
        SelenideElement versionDropDown = $("div.active[data-ng-repeat=\"provisionStep in provisionSteps\"] div.image-container button", 1);
        if (versionDropDown.isDisplayed()) {
            versionDropDown.click();
            SelenideElement dropDown = $(".dropdown-menu.dd-fixed-width");
            dropDown.$(byText(version)).click();
            dropDown.shouldNotBe(visible);
            $(byText(version)).shouldBe(visible);
        }
    }
}
