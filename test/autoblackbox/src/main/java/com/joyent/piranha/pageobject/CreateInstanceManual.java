package com.joyent.piranha.pageobject;

import com.codeborne.selenide.Condition;
import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.PropertyHolder;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
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

    public void selectOsFilter(String os) {
        selectFromSelect2("s2id_selectOS", os);
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
        $("[data-original-title='" + imageName + "']").click();
    }

    public void checkPackageInfo(String mem, String disk, String cpu, String instancePackage) {
        String cssSelector = ".center .value";
        SelenideElement element = $(cssSelector, 0);
        element.waitUntil(not(empty), baseTimeout);
        String text = element.text();
        assertTrue(text.equals(instancePackage));
        assertTrue($(cssSelector, 1).text().equals(mem));
        assertTrue($(cssSelector, 2).text().equals(disk));
        assertTrue($(cssSelector, 3).text().equals(cpu));
        assertTrue($(cssSelector, 4).text().equals(PropertyHolder.getDatacenter(0)));
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
        JavascriptExecutor javascriptExecutor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        javascriptExecutor.executeScript("$('#s2id_filterProperty a').mousedown()");
        getJavascriptExecutor(javascriptExecutor, parameter);
        javascriptExecutor.executeScript("$('#s2id_filterPropertyValue a').mousedown()");
        getJavascriptExecutor(javascriptExecutor, value);
    }

    private void getJavascriptExecutor(JavascriptExecutor javascriptExecutor, String option) {
        javascriptExecutor.executeScript("$('ul div:contains(\"" + option + "\")').mouseup()");
    }

    public CreateInstanceManual clickAllPublicImagesLink() {
        $(byText("All Public Images")).click();
        return page(CreateInstanceManual.class);
    }

    @Override
    public Instances createInstance(InstanceVO instanceVO) {

        page(SideBarMenu.class).clickDashboard().clickCreateComputeInstance();
        clickAllPublicImagesLink();
        selectDataCenter(instanceVO.getDatacenter());
        chooseImage(instanceVO.getImageName());
        selectPackage(instanceVO.getPackageVersion());
        selectPackageVersion(instanceVO.getVersion());
        clickReviewBtn();
        selectNetwork(0);
        setInstanceNameValue(instanceVO.getImageName());
        clickCreateInstanceButton();
        clickButtonInModal("Yes");
        page(Instances.class).getInstanceList().openGridTab(instanceVO.getDatacenter());
        waitForSmallSpinnerDisappear();
        return page(Instances.class);
    }

    @Override
    public void selectDataCenter(String datacenter) {
        SelenideElement select = $("#s2id_selectDatacenter");
        select.waitUntil(Condition.visible, baseTimeout);
        JavascriptExecutor js = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        while (!$(By.xpath("//ul/li[contains(.,'" + datacenter + "')]")).isDisplayed()) {
            js.executeScript("$('#s2id_selectDatacenter a').mousedown()");
        }
        js.executeScript("$('ul div:contains(" + datacenter + ")').mouseup()");
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
