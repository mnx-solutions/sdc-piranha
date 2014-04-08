package com.joyent.piranha.pageobject;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.support.ui.Select;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.page;

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

    public void clickRenameInstanceIcon() {
        //need this crutch because clickable element is always invisible
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('.edit-text-icon').click()");
    }

    public SelenideElement getInstanceNameField() {
        return $("#instanceRename").isDisplayed() ? $("#instanceRename") : $(".page-title");
    }

    public void rename(String name) {
        clickRenameInstanceIcon();
        getInstanceNameField().clear();
        getInstanceNameField().setValue(name);
        $("[data-ng-click=\"clickRename()\"]").click();
        Common.clickButtonInModal("Yes");
        waitForMediumSpinnerDisappear();
    }

    public void selectPackageToResize(int index) {
        $("[href=\"#collapse_resize\"]").click();
        SelenideElement dropDown = $("#collapse_resize");
        dropDown.$(".select2-container a").click();
        Select packages = new Select(dropDown.$("select[name=\"resize\"]"));
        packages.selectByIndex(index);
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
}

