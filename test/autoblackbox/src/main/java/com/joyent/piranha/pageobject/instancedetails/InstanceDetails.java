package com.joyent.piranha.pageobject.instancedetails;

import com.codeborne.selenide.Condition;
import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.*;
import org.apache.commons.lang3.text.WordUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.Select;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;

public class InstanceDetails extends AbstractPageObject {
    private final String name;

    public InstanceDetails(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }


    public void checkTitle() {
        checkTitle(name);
    }

    public ElementsCollection getChartElements() {
        return $$(".detail_chart");
    }

    public Analytics clickDetailedAnalytics() {
        $("#button-detailed-analytics").click();
        return page(Analytics.class);
    }

    public TagSection openTagsSection() {
        $("[href=\"#collapse_tags\"]").click();
        return page(TagSection.class);
    }

    public ImagesSection openImagesSection() {
        $("#accordion1 a[href=\"#collapse_images\"]").click();
        return page(ImagesSection.class);
    }

    public void clickRenameInstanceIcon() {
        //need this crutch because clickable element is always invisible
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('.edit-text-icon').click()");
    }

    public SelenideElement getInstanceNameField() {
        return $("#renameObject").isDisplayed() ? $("#renameObject") : $(".page-title");
    }

    public void rename(String name) {
        clickRenameInstanceIcon();
        getInstanceNameField().clear();
        getInstanceNameField().setValue(name);
        $("[data-ng-click=\"clickRename()\"]").click();
        Common.clickButtonInModal("Yes");
        waitForMediumSpinnerDisappear();
    }

    public void selectResizeOption(String packageDescription) {
        $("[href=\"#collapse_resize\"]").click();
        SelenideElement dropDown = $("#collapse_resize");
        Select packages = new Select(dropDown.$("select[name=\"resize\"]"));
        packages.selectByVisibleText(packageDescription);
        $("#select2-drop").waitWhile(Condition.visible, baseTimeout);
    }

    public void clickResizeButton() {
        $("[data-ng-click=\"clickResize()\"]").click();
    }

    public Zenbox clickResizeButton(String isFakePackage) {
        clickResizeButton();
        WebDriverRunner.getWebDriver().switchTo().frame("zenbox_body");
        return page(Zenbox.class);
    }

    public String getInstanceId() {
        return $("#collapse_summary").$(byText("UUID")).$(By.xpath("../td[2]")).getText();
    }

    public String getSummaryValue(String fieldName) {
        return $("#collapse_summary").$(By.xpath("//tr[contains(.,'" + fieldName + "')]/td[@class='ng-binding']")).text();
    }

    public String getImageUUID() {
        return getSummaryValue("Image UUID");
    }

    public String getImageName() {
        return getSummaryValue("Image");
    }

    public String gitImageVersion() {
        return getSummaryValue("Image version");
    }

    public String getInstanceIP() {
        return $(By.xpath("//tr[contains(.,'IP addresses')]/td/span")).text();
    }

    public MetadataSection openMetadataSection() {
        $("[href=\"#collapse_metadata\"]").click();
        return page(MetadataSection.class);
    }

    public String getMemory() {
        return getSummaryValue("Memory");
    }

    public FirewallSection openResizeSection() {
        $("[href=\"#collapse_firewall\"]").click();
        return page(FirewallSection.class);
    }

    public void openSummarySection() {
        $("[href=\"#collapse_summary\"]").click();
    }

    public void changeState(String state){
        $("[data-ng-click=\"click"+WordUtils.capitalize(state)+"(machine.id)\"]").click();
        clickButtonInModal("Yes");
        waitForSmallSpinnerDisappear();
    }

    public void stopInstance(){
        changeState("stop");
    }

    public void startInstance(){
        changeState("start");
    }

    public void rebootInstance(){
        changeState("reboot");
    }

    public void deleteInstance(){
        changeState("delete");
        clickButtonInModal("Ok");
    }

    public String getInstanceStatus(){
        return $(".status.label").text();
    }
}

